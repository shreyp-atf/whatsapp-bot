/**
 * Script to seed venues from xaikey file
 *
 * This script reads venues from the xaikey file and processes them through
 * the venue agent to create venue, locality, and city region entries.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { runVenueLocalityWorkflow, performVenueDatabaseOperations } from '../ai/venueAgent';
import { withTransaction } from '../db/connection';
import { parseSeedVenuesArgs } from './utils/cliArgs';

interface VenueSeed {
  venue_name: string;
  locality?: string;
  details?: string;
  booking_link?: string;
}

interface VenueProcessingResult {
  success: boolean;
  venue_name: string;
  locality?: string;
  venue_id?: number;
  error?: Error;
  created_new_city?: boolean;
  created_new_city_region?: boolean;
  created_new_locality?: boolean;
  created_new_venue?: boolean;
}

// Configuration: Number of venues to process in parallel per batch
const BATCH_SIZE = 5;

async function processVenue(venue: VenueSeed, enableLogging: boolean = false): Promise<VenueProcessingResult> {
  try {
    console.log(`Processing: "${venue.venue_name}"${venue.locality ? ` in ${venue.locality}` : ''}`);

    // Step 1: Run LLM agent to get venue data
    const venueAgentStart = Date.now();
    const agentResult = await runVenueLocalityWorkflow({
      venue_name: venue.venue_name,
      locality: venue.locality,
      details: venue.details,
      booking_link: venue.booking_link
    }, enableLogging);
    const venueAgentTime = Date.now() - venueAgentStart;
    
    if (enableLogging) {
      console.log(`  [LLM Timing] Venue Agent: ${venueAgentTime}ms`);
      console.log(`  [LLM Response] Venue Agent:`);
      console.log(JSON.stringify(agentResult.output_parsed, null, 2));
    }

    // Step 2: Perform database operations in a transaction
    const dbOpsStart = Date.now();
    const databaseResult = await withTransaction(async (client) => {
      return await performVenueDatabaseOperations(agentResult.output_parsed, client, enableLogging);
    });
    const dbOpsTime = Date.now() - dbOpsStart;
    
    if (enableLogging) {
      console.log(`  [LLM Timing] Database Operations (similarity matching): ${dbOpsTime}ms`);
      console.log(`  [LLM Timing] Total for "${venue.venue_name}": ${venueAgentTime + dbOpsTime}ms`);
    }

    console.log(`  ✓ Success: Venue ID ${databaseResult.venue_id} ${databaseResult.created_new_venue ? '(NEW)' : '(EXISTING)'}`);

    return {
      success: true,
      venue_name: venue.venue_name,
      locality: venue.locality,
      venue_id: databaseResult.venue_id,
      created_new_city: databaseResult.created_new_city,
      created_new_city_region: databaseResult.created_new_city_region,
      created_new_locality: databaseResult.created_new_locality,
      created_new_venue: databaseResult.created_new_venue
    };
  } catch (error) {
    console.error(`  ✗ Failed: "${venue.venue_name}" -`, error instanceof Error ? error.message : String(error));
    return {
      success: false,
      venue_name: venue.venue_name,
      locality: venue.locality,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

async function main() {
  try {
    const config = parseSeedVenuesArgs();
    const { enableLogging, provider } = config;

    // Note: Venue agent currently only supports OpenAI
    // Provider selection is parsed but not yet implemented for venue workflow
    if (provider === 'xai') {
      console.log('⚠ Warning: Venue agent currently only supports OpenAI. Using OpenAI instead.\n');
    }

    if (enableLogging) {
      console.log('📊 LLM query timing enabled\n');
    }

    // Read venues from xaikey file
    const xaikeyPath = "/home/ubuntu/whatsapp-bot/xaikey";
    console.log(`Reading venues from: ${xaikeyPath}\n`);

    const fileContent = readFileSync(xaikeyPath, 'utf-8');
    const venues: VenueSeed[] = JSON.parse(fileContent);

    console.log(`Found ${venues.length} venues to process\n`);
    console.log(`Processing venues in batches of ${BATCH_SIZE}...\n`);

    // Split venues into batches
    const batches: VenueSeed[][] = [];
    for (let i = 0; i < venues.length; i += BATCH_SIZE) {
      batches.push(venues.slice(i, i + BATCH_SIZE));
    }

    // Collect results
    const successful: VenueProcessingResult[] = [];
    const failed: VenueProcessingResult[] = [];

    // Process each batch sequentially, but venues within batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNumber = batchIndex + 1;
      const totalBatches = batches.length;
      
      console.log(`Batch ${batchNumber}/${totalBatches} (${batch.length} venues)...`);

      const batchResults = await Promise.allSettled(
        batch.map(venue => processVenue(venue, enableLogging))
      );

      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successful.push(result.value);
          } else {
            failed.push(result.value);
          }
        } else {
          failed.push({
            success: false,
            venue_name: batch[index]?.venue_name || 'Unknown',
            locality: batch[index]?.locality,
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason))
          });
        }
      });

      const batchSuccessful = batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const batchFailed = batch.length - batchSuccessful;
      console.log(`Batch ${batchNumber} complete: ${batchSuccessful} succeeded, ${batchFailed} failed\n`);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total venues: ${venues.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\nSuccessful venues:');
      successful.forEach(v => {
        const details = [
          v.created_new_city ? 'City' : null,
          v.created_new_city_region ? 'CityRegion' : null,
          v.created_new_locality ? 'Locality' : null,
          v.created_new_venue ? 'Venue' : null
        ].filter(Boolean).join(', ');
        console.log(`  ✓ ${v.venue_name} (ID: ${v.venue_id})${details ? ` - Created: ${details}` : ''}`);
      });
    }

    if (failed.length > 0) {
      console.log('\nFailed venues:');
      failed.forEach(v => {
        console.log(`  ✗ ${v.venue_name} - ${v.error?.message || 'Unknown error'}`);
      });
    }

    console.log('\n✓ Seed script completed');
  } catch (error) {
    console.error('✗ Error running seed script:', error);
    process.exit(1);
  }
}

// Run the script
main();
