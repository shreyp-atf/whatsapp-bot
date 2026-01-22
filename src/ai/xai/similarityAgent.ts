/**
 * xAI Similarity Matching Agent
 * 
 * Provides xAI-based similarity matching for localities, city regions, and venues.
 * Uses the same prompts and schemas as OpenAI similarity agents.
 */

import { BaseXaiAgent } from './legacy/baseAgent';
import {
  LocalitySimilaritySchema,
  CityRegionSimilaritySchema,
  VenueSimilaritySchema,
  type LocalitySimilarityResult,
  type CityRegionSimilarityResult,
  type VenueSimilarityResult
} from '../utils/schemas';
import {
  getLocalitySimilarityPrompt,
  getCityRegionSimilarityPrompt,
  getVenueSimilarityPrompt,
  getLocalitySimilarityUserMessage,
  getCityRegionSimilarityUserMessage,
  getVenueSimilarityUserMessage
} from '../utils/similarityPrompts';

// Similarity input types (same as OpenAI)
export interface LocalitySimilarityInput {
  new_locality: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    pincode: string;
  };
  existing_localities: Array<{
    locality_id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    pincode: string;
  }>;
}

export interface CityRegionSimilarityInput {
  new_city_region: {
    name: string;
    city_id: number;
  };
  existing_city_regions: Array<{
    city_region_id: number;
    name: string;
    city_id: number;
  }>;
}

export interface VenueSimilarityInput {
  new_venue: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    locality_id: number;
  };
  existing_venues: Array<{
    venue_id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    locality_id: number;
  }>;
}

/**
 * Locality similarity agent
 */
class LocalitySimilarityAgent extends BaseXaiAgent<LocalitySimilarityInput, LocalitySimilarityResult> {
  getName(): string {
    return 'Locality Similarity Matching Agent (xAI)';
  }

  getInstructions(): string {
    return getLocalitySimilarityPrompt();
  }

  buildUserMessage(input: LocalitySimilarityInput): string {
    return getLocalitySimilarityUserMessage(input.new_locality, input.existing_localities);
  }
}

/**
 * City region similarity agent
 */
class CityRegionSimilarityAgent extends BaseXaiAgent<CityRegionSimilarityInput, CityRegionSimilarityResult> {
  getName(): string {
    return 'City Region Similarity Matching Agent (xAI)';
  }

  getInstructions(): string {
    return getCityRegionSimilarityPrompt();
  }

  buildUserMessage(input: CityRegionSimilarityInput): string {
    return getCityRegionSimilarityUserMessage(input.new_city_region, input.existing_city_regions);
  }
}

/**
 * Venue similarity agent
 */
class VenueSimilarityAgent extends BaseXaiAgent<VenueSimilarityInput, VenueSimilarityResult> {
  getName(): string {
    return 'Venue Similarity Matching Agent (xAI)';
  }

  getInstructions(): string {
    return getVenueSimilarityPrompt();
  }

  buildUserMessage(input: VenueSimilarityInput): string {
    return getVenueSimilarityUserMessage(input.new_venue, input.existing_venues);
  }
}

// Create singleton instances
const localitySimilarityAgent = new LocalitySimilarityAgent(
  'Locality Similarity Matching Agent (xAI)',
  LocalitySimilaritySchema
);

const cityRegionSimilarityAgent = new CityRegionSimilarityAgent(
  'City Region Similarity Matching Agent (xAI)',
  CityRegionSimilaritySchema
);

const venueSimilarityAgent = new VenueSimilarityAgent(
  'Venue Similarity Matching Agent (xAI)',
  VenueSimilaritySchema
);

/**
 * Find closest locality match using xAI
 */
export async function findClosestLocalityMatch(
  input: LocalitySimilarityInput,
  enableLogging: boolean = false
): Promise<LocalitySimilarityResult> {
  const result = await localitySimilarityAgent.execute(input, { enableLogging });
  
  if (!result.success || !result.data) {
    throw result.error || new Error('Locality similarity matching failed');
  }
  
  return result.data;
}

/**
 * Find closest city region match using xAI
 */
export async function findClosestCityRegionMatch(
  input: CityRegionSimilarityInput,
  enableLogging: boolean = false
): Promise<CityRegionSimilarityResult> {
  const result = await cityRegionSimilarityAgent.execute(input, { enableLogging });
  
  if (!result.success || !result.data) {
    throw result.error || new Error('City region similarity matching failed');
  }
  
  return result.data;
}

/**
 * Find closest venue match using xAI
 */
export async function findClosestVenueMatch(
  input: VenueSimilarityInput,
  enableLogging: boolean = false
): Promise<VenueSimilarityResult> {
  const result = await venueSimilarityAgent.execute(input, { enableLogging });
  
  if (!result.success || !result.data) {
    throw result.error || new Error('Venue similarity matching failed');
  }
  
  return result.data;
}

// Export similarity matcher instances for use in dbOperations
export const xaiLocalitySimilarityMatcher = localitySimilarityAgent;
export const xaiCityRegionSimilarityMatcher = cityRegionSimilarityAgent;
export const xaiVenueSimilarityMatcher = venueSimilarityAgent;
