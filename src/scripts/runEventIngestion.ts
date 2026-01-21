/**
 * Script to run event ingestion pipeline
 *
 * This script takes a URL, runs it through the sample agent to extract events,
 * processes venues through the venue agent, and creates activity venue map entries.
 */

import { runWorkflow } from '../ai/sample_agent_with_web_search';
import { runVenueLocalityWorkflow, performVenueDatabaseOperations } from '../ai/venueAgent';
import { getAllActivities, searchActivitiesByName, createActivity } from '../db/activity';
import { createActivityVenueMap } from '../db/activityVenueMap';
import { withTransaction } from '../db/connection';

interface ProcessedEvent {
  activity_id: number;
  activity_name: string;
  venues: ProcessedVenue[];
}

interface ProcessedVenue {
  venue_id: number;
  timings: Array<{
    date: string;
    start: string;
    is_ticketed: boolean;
    min_price: number | null;
    duration: string | null;
  }>;
  booking_links: string[];
  description: string;
}

interface VenueAgentOutput {
  output_parsed: any; // The agent output schema
}

interface VenueProcessingResult {
  success: boolean;
  venue?: ProcessedVenue;
  error?: Error;
  venueName: string;
  city: string;
}

async function main() {
  try {
    // Get URL from command line arguments
    const args = process.argv.slice(2);

    if (args.length < 1) {
      console.error('✗ Error: URL is required as command line argument');
      console.log('Usage: ts-node src/scripts/runEventIngestion.ts "<url>"');
      console.log('Example: ts-node src/scripts/runEventIngestion.ts "https://example.com/events"');
      process.exit(1);
    }

    const url = args[0];

    console.log('Starting event ingestion pipeline...\n');
    console.log(`URL: ${url}\n`);

    // Step 1: Run sample agent to extract events
    console.log('Step 1: Extracting events from URL...');
    const sampleAgentResult = await runWorkflow({ input_as_text: url });

    const events = sampleAgentResult.output_parsed.events;
    console.log(`✓ Found ${events.length} events\n`);

    if (events.length === 0) {
      console.log('No events found. Exiting.');
      return;
    }

    // Step 2: Process each event
    const processedEvents: ProcessedEvent[] = [];

    for (const event of events) {
      console.log(`Processing event: "${event.activity}"`);

      // Find or create activity
      let activityId: number;
      const existingActivities = await searchActivitiesByName(event.activity);

      if (existingActivities.length > 0) {
        // Use the first match (assuming exact match or close enough)
        activityId = existingActivities[0].activity_id;
        console.log(`  ✓ Using existing activity: ${existingActivities[0].name} (ID: ${activityId})`);
      } else {
        // Create new activity
        const allActivities = await getAllActivities();
        const maxActivityId = allActivities.length > 0 ? Math.max(...allActivities.map(a => a.activity_id)) : 0;
        const newActivityId = maxActivityId + 1;

        const newActivity = await createActivity({
          activity_id: newActivityId,
          name: event.activity,
          description: `${event.activity} events`,
          quorum: 2 // Default quorum
        });

        activityId = newActivity.activity_id;
        console.log(`  ✓ Created new activity: ${newActivity.name} (ID: ${activityId})`);
      }

      // Process venues in parallel (LLM calls first, then database operations in transactions)
      console.log(`    Processing ${event.venues.length} venue(s) in parallel...`);
      
      // Step 1: Run LLM calls for all venues in parallel
      const venueAgentPromises = event.venues.map(venue => 
        runVenueLocalityWorkflow({ venue_name: venue.venue_name })
      );
      
      const venueAgentResults = await Promise.allSettled(venueAgentPromises);
      
      // Step 2: Process database operations and AVM creation in transactions
      const venueProcessingPromises = venueAgentResults.map((agentResult, index) => {
        const venue = event.venues[index];
        if (agentResult.status === 'fulfilled') {
          return processVenueWithTransaction(venue, event.activity, agentResult.value.output_parsed, activityId);
        } else {
          return Promise.resolve({
            success: false,
            error: agentResult.reason instanceof Error ? agentResult.reason : new Error(String(agentResult.reason)),
            venueName: venue.venue_name,
            city: venue.city
          } as VenueProcessingResult);
        }
      });

      const venueResults = await Promise.allSettled(venueProcessingPromises);
      const processedVenues: ProcessedVenue[] = [];
      let successCount = 0;
      let failureCount = 0;

      venueResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.venue) {
          processedVenues.push(result.value.venue);
          successCount++;
          console.log(`      ✓ Venue "${result.value.venueName}" processed successfully (ID: ${result.value.venue.venue_id})`);
        } else {
          failureCount++;
          const error = result.status === 'rejected' 
            ? result.reason 
            : result.value.error;
          const venueName = result.status === 'fulfilled' 
            ? result.value.venueName 
            : event.venues[index]?.venue_name || 'Unknown';
          console.error(`      ✗ Failed to process venue "${venueName}":`, error);
        }
      });

      console.log(`    Venue processing complete: ${successCount} succeeded, ${failureCount} failed`);

      processedEvents.push({
        activity_id: activityId,
        activity_name: event.activity,
        venues: processedVenues
      });

      console.log(`✓ Event "${event.activity}" processed with ${processedVenues.length} venues\n`);
    }

    // AVM entries are now created within the transaction during venue processing
    const totalAvmCreated = processedEvents.reduce((sum, event) => 
      sum + event.venues.reduce((venueSum, venue) => venueSum + venue.timings.length, 0), 0
    );

    console.log('\n🎉 Event ingestion completed successfully!');
    console.log(`Summary:`);
    console.log(`  - Events processed: ${processedEvents.length}`);
    console.log(`  - Total AVM entries created: ${totalAvmCreated}`);

  } catch (error) {
    console.error('✗ Error running event ingestion:', error);
    process.exit(1);
  }
}

/**
 * Process a single venue with database operations and AVM creation in a single transaction
 * This function wraps venue database operations and AVM creation in a transaction
 */
async function processVenueWithTransaction(
  venue: { venue_name: string; city: string; timings: ProcessedVenue['timings']; booking_links: string[] },
  activityName: string,
  agentOutput: any,
  activityId: number
): Promise<VenueProcessingResult> {
  try {
    return await withTransaction(async (client) => {
      // Perform database operations (city, city_region, locality, venue) within transaction
      const databaseResult = await performVenueDatabaseOperations(agentOutput, client);
      const venueId = databaseResult.venue_id;

      // Create AVM entries for each timing within the same transaction
      for (const timing of venue.timings) {
        // Parse date and time
        const eventDate = new Date(timing.date);
        const [startHour, startMinute] = timing.start.split(':').map(Number);

        // Set start time
        const startTime = new Date(eventDate);
        startTime.setHours(startHour, startMinute, 0, 0);

        // Calculate end time based on duration if available
        let endTime = new Date(startTime);
        if (timing.duration) {
          // Parse duration (assuming format like "2 hours" or "90 minutes")
          const durationMatch = timing.duration.match(/(\d+)\s*(hour|minute|hr|min)/i);
          if (durationMatch) {
            const durationValue = parseInt(durationMatch[1]);
            const durationUnit = durationMatch[2].toLowerCase();

            if (durationUnit.includes('hour') || durationUnit.includes('hr')) {
              endTime.setHours(endTime.getHours() + durationValue);
            } else if (durationUnit.includes('minute') || durationUnit.includes('min')) {
              endTime.setMinutes(endTime.getMinutes() + durationValue);
            }
          } else {
            // Default to 2 hours if duration parsing fails
            endTime.setHours(endTime.getHours() + 2);
          }
        } else {
          // Default to 2 hours if no duration
          endTime.setHours(endTime.getHours() + 2);
        }

        // Create activity venue map entry within transaction
        await createActivityVenueMap({
          activity_id: activityId,
          venue_id: venueId,
          start_time: startTime,
          end_time: endTime,
          is_active: true,
          is_public: true,
          max_people: 50, // Default capacity
          parallel_slots: 1,
          is_hosted: false,
          date: eventDate,
          is_ticketed: timing.is_ticketed,
          ticket_price: timing.min_price || undefined,
          description: `${activityName} at ${venue.venue_name}`,
          booking_link: venue.booking_links.length > 0 ? venue.booking_links[0] : ''
        }, client);
      }

      // Prepare venue data for return
      const processedVenue: ProcessedVenue = {
        venue_id: venueId,
        timings: venue.timings,
        booking_links: venue.booking_links,
        description: `${activityName} at ${venue.venue_name}`
      };

      return {
        success: true,
        venue: processedVenue,
        venueName: venue.venue_name,
        city: venue.city
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      venueName: venue.venue_name,
      city: venue.city
    };
  }
}

// Run the script
main();