/**
 * xAI Activity Venue Map Agent
 * 
 * Extracts activity venue map (event) information from a URL and creates entry if it doesn't exist.
 */

import { BaseXaiAgent } from './baseAgent';
import { ActivityVenueMapRowSchema, type ActivityVenueMapRow } from '../../utils/schemas';
import {
  getActivityVenueMapExtractionPrompt,
  getActivityVenueMapExtractionUserMessage
} from '../../utils/extractionPrompts';
import { createActivityVenueMap, getActivityVenueMapsByActivityAndVenue } from '../../../db/activityVenueMap';
import { logger } from '../../utils/logging';

export interface ActivityVenueMapAgentInput {
  url: string;
  activity_id: number;
  activity_name: string;
  venue_id: number;
  venue_name: string;
}

export interface ActivityVenueMapAgentOutput {
  activity_venue_map_id: number;
  activity_venue_map_row: ActivityVenueMapRow;
  created: boolean;
}

/**
 * Activity venue map extraction agent
 */
class ActivityVenueMapExtractionAgent extends BaseXaiAgent<ActivityVenueMapAgentInput, ActivityVenueMapRow> {
  getName(): string {
    return 'Activity Venue Map Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getActivityVenueMapExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract event information.';
  }

  buildUserMessage(input: ActivityVenueMapAgentInput): string {
    return getActivityVenueMapExtractionUserMessage(input.url, input.activity_name, input.venue_name);
  }
}

/**
 * Singleton xAI Activity Venue Map Agent instance
 */
export const xaiActivityVenueMapAgent = new ActivityVenueMapExtractionAgent(
  'Activity Venue Map Extraction Agent (xAI)',
  ActivityVenueMapRowSchema
);

/**
 * Extract activity venue map from URL and create if not exists
 */
export async function extractAndCreateActivityVenueMap(
  input: ActivityVenueMapAgentInput,
  options?: { enableLogging?: boolean; client?: any }
): Promise<ActivityVenueMapAgentOutput> {
  const { enableLogging = false, client } = options || {};

  try {
    // Extract activity venue map information from URL
    if (enableLogging) {
      logger.info('Extracting activity venue map information from URL', {
        url: input.url,
        activityId: input.activity_id,
        venueId: input.venue_id
      });
    }

    const extractionResult = await xaiActivityVenueMapAgent.execute(input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('Activity venue map extraction failed');
    }

    const avmRow = extractionResult.data;

    // Check if activity venue map exists for this activity and venue combination
    const existingAVMs = await getActivityVenueMapsByActivityAndVenue(
      input.activity_id,
      input.venue_id
    );

    // Check if there's an existing AVM with the same date and similar time
    const eventDate = new Date(avmRow.date);
    const existingAVM = existingAVMs.find(avm => {
      const avmDate = new Date(avm.date);
      return avmDate.toDateString() === eventDate.toDateString();
    });

    let avmId: number;
    let created = false;

    if (existingAVM) {
      // Use existing AVM
      avmId = existingAVM.id;
    } else {
      // Create new activity venue map
      const startTime = new Date(avmRow.start_time);
      const endTime = new Date(avmRow.end_time);

      const newAVM = await createActivityVenueMap({
        activity_id: input.activity_id,
        venue_id: input.venue_id,
        start_time: startTime,
        end_time: endTime,
        is_active: avmRow.is_active,
        is_public: avmRow.is_public,
        max_people: avmRow.max_people,
        parallel_slots: avmRow.parallel_slots,
        is_hosted: avmRow.is_hosted,
        date: eventDate,
        is_ticketed: avmRow.is_ticketed,
        ticket_price: avmRow.ticket_price || undefined,
        description: avmRow.description,
        img_url: avmRow.img_url || undefined,
        booking_link: avmRow.booking_link
      }, client);
      avmId = newAVM.id;
      created = true;
    }

    if (enableLogging) {
      logger.info('Activity venue map processed', {
        avmId,
        created,
        activityId: input.activity_id,
        venueId: input.venue_id
      });
    }

    return {
      activity_venue_map_id: avmId,
      activity_venue_map_row: avmRow,
      created
    };
  } catch (error) {
    logger.error('Failed to extract and create activity venue map', error instanceof Error ? error : new Error(String(error)), {
      url: input.url,
      activityId: input.activity_id,
      venueId: input.venue_id
    });
    throw error;
  }
}
