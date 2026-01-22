/**
 * xAI City Agent
 * 
 * Extracts city information from a URL and creates city entry if it doesn't exist.
 */

import { BaseXaiAgent } from './baseAgent';
import { CityRowSchema, type CityRow } from '../utils/schemas';
import {
  getCityExtractionPrompt,
  getCityExtractionUserMessage
} from '../utils/extractionPrompts';
import { getCityByNameAndCountry, createCity } from '../../db/city';
import { logger } from '../utils/logging';

export interface CityAgentInput {
  url: string;
}

export interface CityAgentOutput {
  city_id: number;
  city_row: CityRow;
  created: boolean;
}

/**
 * City extraction agent
 */
class CityExtractionAgent extends BaseXaiAgent<CityAgentInput, CityRow> {
  getName(): string {
    return 'City Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getCityExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract city information.';
  }

  buildUserMessage(input: CityAgentInput): string {
    return getCityExtractionUserMessage(input.url);
  }
}

/**
 * Singleton xAI City Agent instance
 */
export const xaiCityAgent = new CityExtractionAgent(
  'City Extraction Agent (xAI)',
  CityRowSchema
);

/**
 * Extract city from URL and create if not exists
 */
export async function extractAndCreateCity(
  input: CityAgentInput,
  options?: { enableLogging?: boolean; client?: any }
): Promise<CityAgentOutput> {
  const { enableLogging = false, client } = options || {};

  try {
    // Extract city information from URL
    if (enableLogging) {
      logger.info('Extracting city information from URL', { url: input.url });
    }

    const extractionResult = await xaiCityAgent.execute(input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('City extraction failed');
    }

    const cityRow = extractionResult.data;

    // Find or create city in database
    const existingCity = await getCityByNameAndCountry(cityRow.name, cityRow.country, client);
    
    let cityId: number;
    let created = false;
    
    if (existingCity) {
      cityId = existingCity.city_id;
    } else {
      // Create new city
      const newCity = await createCity({
        name: cityRow.name,
        country: cityRow.country
      }, client);
      cityId = newCity.city_id;
      created = true;
    }

    if (enableLogging) {
      logger.info('City processed', {
        cityId,
        created,
        name: cityRow.name
      });
    }

    return {
      city_id: cityId,
      city_row: cityRow,
      created
    };
  } catch (error) {
    logger.error('Failed to extract and create city', error instanceof Error ? error : new Error(String(error)), {
      url: input.url
    });
    throw error;
  }
}
