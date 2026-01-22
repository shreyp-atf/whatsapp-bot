/**
 * xAI Similarity Matching Executor
 * 
 * Provides xAI-based similarity matching using the unified agent executor pattern.
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
 * Find closest locality match using xAI
 */
export async function findClosestLocalityMatch(
  input: LocalitySimilarityInput,
  enableLogging: boolean = false
): Promise<LocalitySimilarityResult> {
  const result = await executeAgent('locality-similarity', input, {
    enableLogging,
    metadata: { provider: 'xai' }
  });
  
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
  const result = await executeAgent('city-region-similarity', input, {
    enableLogging,
    metadata: { provider: 'xai' }
  });
  
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
  const result = await executeAgent('venue-similarity', input, {
    enableLogging,
    metadata: { provider: 'xai' }
  });
  
  if (!result.success || !result.data) {
    throw result.error || new Error('Venue similarity matching failed');
  }
  
  return result.data;
}
