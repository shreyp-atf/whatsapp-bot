/**
 * xAI Venue Agent
 * 
 * Extracts venue information from a URL and creates venue entry if it doesn't exist.
 */

import { BaseXaiAgent } from './baseAgent';
import { VenueRowSchema, type VenueRow } from '../../utils/schemas';
import {
  getVenueFromUrlExtractionPrompt,
  getVenueFromUrlExtractionUserMessage
} from '../../utils/extractionPrompts';
import { createVenue, getAllVenues } from '../../../db/venue';
import { findClosestVenueMatch } from '../similarityAgent';
import { logger } from '../../utils/logging';

export interface VenueAgentInput {
  url: string;
  locality_id: number;
  locality_name: string;
}

export interface VenueAgentOutput {
  venue_id: number;
  venue_row: VenueRow;
  created: boolean;
}

/**
 * Venue extraction agent
 */
class VenueExtractionAgent extends BaseXaiAgent<VenueAgentInput, VenueRow> {
  getName(): string {
    return 'Venue Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getVenueFromUrlExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract venue information.';
  }

  buildUserMessage(input: VenueAgentInput): string {
    return getVenueFromUrlExtractionUserMessage(input.url, input.locality_name);
  }
}

/**
 * Singleton xAI Venue Agent instance
 */
export const xaiVenueAgent = new VenueExtractionAgent(
  'Venue Extraction Agent (xAI)',
  VenueRowSchema
);

/**
 * Extract venue from URL and create if not exists
 */
export async function extractAndCreateVenue(
  input: VenueAgentInput,
  options?: { enableLogging?: boolean; client?: any }
): Promise<VenueAgentOutput> {
  const { enableLogging = false, client } = options || {};

  try {
    // Extract venue information from URL
    if (enableLogging) {
      logger.info('Extracting venue information from URL', {
        url: input.url,
        localityId: input.locality_id
      });
    }

    const extractionResult = await xaiVenueAgent.execute(input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('Venue extraction failed');
    }

    const venueRow = extractionResult.data;

    // Get all venues for similarity matching
    const allVenues = await getAllVenues();
    
    // Perform similarity matching
    const similarityResult = await findClosestVenueMatch({
      new_venue: {
        name: venueRow.name,
        address: venueRow.address,
        latitude: venueRow.latitude,
        longitude: venueRow.longitude,
        locality_id: input.locality_id
      },
      existing_venues: allVenues.map(v => ({
        venue_id: v.venue_id,
        name: v.name,
        address: v.address,
        latitude: v.latitude,
        longitude: v.longitude,
        locality_id: v.locality_id
      }))
    }, enableLogging);

    let venueId: number;
    let created = false;

    if (similarityResult.closest_match_id && similarityResult.confidence_score >= 0.9) {
      venueId = similarityResult.closest_match_id;
    } else {
      // Create new venue
      const newVenue = await createVenue({
        name: venueRow.name,
        latitude: venueRow.latitude,
        longitude: venueRow.longitude,
        google_maps_location: venueRow.google_maps_location,
        directions_to_reach: venueRow.directions_to_reach,
        address: venueRow.address,
        is_public: venueRow.is_public,
        is_active: venueRow.is_active,
        is_verified: venueRow.is_verified,
        is_approved: venueRow.is_approved,
        price_point: venueRow.price_point,
        open_time: venueRow.open_time,
        close_time: venueRow.close_time,
        locality_id: input.locality_id,
        type: venueRow.type
      }, client);
      venueId = newVenue.venue_id;
      created = true;
    }

    if (enableLogging) {
      logger.info('Venue processed', {
        venueId,
        created,
        name: venueRow.name
      });
    }

    return {
      venue_id: venueId,
      venue_row: venueRow,
      created
    };
  } catch (error) {
    logger.error('Failed to extract and create venue', error instanceof Error ? error : new Error(String(error)), {
      url: input.url,
      localityId: input.locality_id
    });
    throw error;
  }
}
