/**
 * xAI City Region Agent
 * 
 * Extracts city region information from a URL and creates city region entry if it doesn't exist.
 */

import { BaseXaiAgent } from './baseAgent';
import { CityRegionRowSchema, type CityRegionRow } from '../utils/schemas';
import {
  getCityRegionExtractionPrompt,
  getCityRegionExtractionUserMessage
} from '../utils/extractionPrompts';
import { createCityRegion, getAllCityRegions } from '../../db/cityRegion';
import { findClosestCityRegionMatch } from './similarityAgent';
import { logger } from '../utils/logging';

export interface CityRegionAgentInput {
  url: string;
  city_id: number;
  city_name: string;
}

export interface CityRegionAgentOutput {
  city_region_id: number;
  city_region_row: CityRegionRow;
  created: boolean;
}

/**
 * City region extraction agent
 */
class CityRegionExtractionAgent extends BaseXaiAgent<CityRegionAgentInput, CityRegionRow> {
  getName(): string {
    return 'City Region Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getCityRegionExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract city region information.';
  }

  buildUserMessage(input: CityRegionAgentInput): string {
    return getCityRegionExtractionUserMessage(input.url, input.city_name);
  }
}

/**
 * Singleton xAI City Region Agent instance
 */
export const xaiCityRegionAgent = new CityRegionExtractionAgent(
  'City Region Extraction Agent (xAI)',
  CityRegionRowSchema
);

/**
 * Extract city region from URL and create if not exists
 */
export async function extractAndCreateCityRegion(
  input: CityRegionAgentInput,
  options?: { enableLogging?: boolean; client?: any }
): Promise<CityRegionAgentOutput> {
  const { enableLogging = false, client } = options || {};

  try {
    // Extract city region information from URL
    if (enableLogging) {
      logger.info('Extracting city region information from URL', {
        url: input.url,
        cityId: input.city_id
      });
    }

    const extractionResult = await xaiCityRegionAgent.execute(input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('City region extraction failed');
    }

    const cityRegionRow = extractionResult.data;

    // Find or create city region with similarity matching
    const allCityRegions = await getAllCityRegions();
    const existingCityRegion = allCityRegions.find(
      cr => cr.name.toLowerCase() === cityRegionRow.name.toLowerCase() && cr.city_id === input.city_id
    );

    let cityRegionId: number;
    let created = false;

    if (existingCityRegion) {
      cityRegionId = existingCityRegion.city_region_id;
    } else {
      // Try similarity matching
      const similarityResult = await findClosestCityRegionMatch({
        new_city_region: {
          name: cityRegionRow.name,
          city_id: input.city_id
        },
        existing_city_regions: allCityRegions.map(cr => ({
          city_region_id: cr.city_region_id,
          name: cr.name,
          city_id: cr.city_id
        }))
      }, enableLogging);

      if (similarityResult.closest_match_id && similarityResult.confidence_score >= 0.8) {
        cityRegionId = similarityResult.closest_match_id;
      } else {
        // Create new city region
        const newCityRegion = await createCityRegion({
          city_id: input.city_id,
          name: cityRegionRow.name
        }, client);
        cityRegionId = newCityRegion.city_region_id;
        created = true;
      }
    }

    if (enableLogging) {
      logger.info('City region processed', {
        cityRegionId,
        created,
        name: cityRegionRow.name
      });
    }

    return {
      city_region_id: cityRegionId,
      city_region_row: cityRegionRow,
      created
    };
  } catch (error) {
    logger.error('Failed to extract and create city region', error instanceof Error ? error : new Error(String(error)), {
      url: input.url,
      cityId: input.city_id
    });
    throw error;
  }
}
