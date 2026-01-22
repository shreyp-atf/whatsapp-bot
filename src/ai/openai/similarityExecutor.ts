/**
 * OpenAI Similarity Matching Executor
 * 
 * Provides OpenAI-based similarity matching using the unified agent executor pattern.
 */

import { executeAgent } from './agentExecutor';
import type {
  LocalitySimilarityResult,
  CityRegionSimilarityResult,
  VenueSimilarityResult
} from '../utils/schemas';
import type {
  LocalitySimilarityInput,
  CityRegionSimilarityInput,
  VenueSimilarityInput
} from '../utils/agents/agentDefinitions';

/**
 * Find closest locality match using OpenAI
 */
export async function findClosestLocalityMatch(
  input: LocalitySimilarityInput,
  enableLogging: boolean = false
): Promise<LocalitySimilarityResult> {
  const result = await executeAgent('locality-similarity', input, {
    enableLogging,
    metadata: { provider: 'openai' }
  });
  
  if (!result.success || !result.data) {
    throw result.error || new Error('Locality similarity matching failed');
  }
  
  return result.data;
}

/**
 * Find closest city region match using OpenAI
 */
export async function findClosestCityRegionMatch(
  input: CityRegionSimilarityInput,
  enableLogging: boolean = false
): Promise<CityRegionSimilarityResult> {
  const result = await executeAgent('city-region-similarity', input, {
    enableLogging,
    metadata: { provider: 'openai' }
  });
  
  if (!result.success || !result.data) {
    throw result.error || new Error('City region similarity matching failed');
  }
  
  return result.data;
}

/**
 * Find closest venue match using OpenAI
 */
export async function findClosestVenueMatch(
  input: VenueSimilarityInput,
  enableLogging: boolean = false
): Promise<VenueSimilarityResult> {
  const result = await executeAgent('venue-similarity', input, {
    enableLogging,
    metadata: { provider: 'openai' }
  });
  
  if (!result.success || !result.data) {
    throw result.error || new Error('Venue similarity matching failed');
  }
  
  return result.data;
}
