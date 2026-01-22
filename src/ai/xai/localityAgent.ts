/**
 * xAI Locality Agent
 * 
 * Extracts locality information from a URL and creates locality entry if it doesn't exist.
 */

import { BaseXaiAgent } from './baseAgent';
import { LocalityRowSchema, type LocalityRow } from '../utils/schemas';
import {
  getLocalityExtractionPrompt,
  getLocalityExtractionUserMessage
} from '../utils/extractionPrompts';
import { createLocality, getAllLocalities } from '../../db/locality';
import { findClosestLocalityMatch } from './similarityAgent';
import { logger } from '../utils/logging';

export interface LocalityAgentInput {
  url: string;
  city_region_id: number;
  city_region_name: string;
}

export interface LocalityAgentOutput {
  locality_id: number;
  locality_row: LocalityRow;
  created: boolean;
}

/**
 * Locality extraction agent
 */
class LocalityExtractionAgent extends BaseXaiAgent<LocalityAgentInput, LocalityRow> {
  getName(): string {
    return 'Locality Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getLocalityExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract locality information.';
  }

  buildUserMessage(input: LocalityAgentInput): string {
    return getLocalityExtractionUserMessage(input.url, input.city_region_name);
  }
}

/**
 * Singleton xAI Locality Agent instance
 */
export const xaiLocalityAgent = new LocalityExtractionAgent(
  'Locality Extraction Agent (xAI)',
  LocalityRowSchema
);

/**
 * Extract locality from URL and create if not exists
 */
export async function extractAndCreateLocality(
  input: LocalityAgentInput,
  options?: { enableLogging?: boolean; client?: any }
): Promise<LocalityAgentOutput> {
  const { enableLogging = false, client } = options || {};

  try {
    // Extract locality information from URL
    if (enableLogging) {
      logger.info('Extracting locality information from URL', {
        url: input.url,
        cityRegionId: input.city_region_id
      });
    }

    const extractionResult = await xaiLocalityAgent.execute(input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('Locality extraction failed');
    }

    const localityRow = extractionResult.data;

    // Get all localities for similarity matching
    const allLocalities = await getAllLocalities();
    
    // Perform similarity matching
    const similarityResult = await findClosestLocalityMatch({
      new_locality: {
        name: localityRow.name,
        address: localityRow.address,
        latitude: localityRow.latitude,
        longitude: localityRow.longitude,
        pincode: localityRow.pincode
      },
      existing_localities: allLocalities.map(l => ({
        locality_id: l.locality_id,
        name: l.name,
        address: l.address,
        latitude: l.latitude,
        longitude: l.longitude,
        pincode: l.pincode
      }))
    }, enableLogging);

    let localityId: number;
    let created = false;

    if (similarityResult.closest_match_id && similarityResult.confidence_score >= 0.8) {
      localityId = similarityResult.closest_match_id;
    } else {
      // Create new locality
      const newLocality = await createLocality({
        name: localityRow.name,
        pincode: localityRow.pincode,
        address: localityRow.address,
        latitude: localityRow.latitude,
        longitude: localityRow.longitude,
        city_region_id: input.city_region_id
      }, client);
      localityId = newLocality.locality_id;
      created = true;
    }

    if (enableLogging) {
      logger.info('Locality processed', {
        localityId,
        created,
        name: localityRow.name
      });
    }

    return {
      locality_id: localityId,
      locality_row: localityRow,
      created
    };
  } catch (error) {
    logger.error('Failed to extract and create locality', error instanceof Error ? error : new Error(String(error)), {
      url: input.url,
      cityRegionId: input.city_region_id
    });
    throw error;
  }
}
