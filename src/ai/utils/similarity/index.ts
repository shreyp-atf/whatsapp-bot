/**
 * Provider-Agnostic Similarity Matching
 * 
 * Routes similarity matching requests to provider-specific executors.
 */

import type { Provider } from '../providerSelection';
import type {
  LocalitySimilarityResult,
  CityRegionSimilarityResult,
  VenueSimilarityResult
} from '../schemas';
import type {
  LocalitySimilarityInput,
  CityRegionSimilarityInput,
  VenueSimilarityInput
} from '../agents/agentDefinitions';

/**
 * Find closest locality match using specified provider
 */
export async function findClosestLocalityMatch(
  input: LocalitySimilarityInput,
  provider: Provider,
  options?: { enableLogging?: boolean }
): Promise<LocalitySimilarityResult> {
  if (provider === 'xai') {
    const { findClosestLocalityMatch: xaiFindMatch } = await import('../../xai/similarityExecutor');
    return xaiFindMatch(input, options?.enableLogging || false);
  } else {
    const { findClosestLocalityMatch: openaiFindMatch } = await import('../../openai/similarityExecutor');
    return openaiFindMatch(input, options?.enableLogging || false);
  }
}

/**
 * Find closest city region match using specified provider
 */
export async function findClosestCityRegionMatch(
  input: CityRegionSimilarityInput,
  provider: Provider,
  options?: { enableLogging?: boolean }
): Promise<CityRegionSimilarityResult> {
  if (provider === 'xai') {
    const { findClosestCityRegionMatch: xaiFindMatch } = await import('../../xai/similarityExecutor');
    return xaiFindMatch(input, options?.enableLogging || false);
  } else {
    const { findClosestCityRegionMatch: openaiFindMatch } = await import('../../openai/similarityExecutor');
    return openaiFindMatch(input, options?.enableLogging || false);
  }
}

/**
 * Find closest venue match using specified provider
 */
export async function findClosestVenueMatch(
  input: VenueSimilarityInput,
  provider: Provider,
  options?: { enableLogging?: boolean }
): Promise<VenueSimilarityResult> {
  if (provider === 'xai') {
    const { findClosestVenueMatch: xaiFindMatch } = await import('../../xai/similarityExecutor');
    return xaiFindMatch(input, options?.enableLogging || false);
  } else {
    const { findClosestVenueMatch: openaiFindMatch } = await import('../../openai/similarityExecutor');
    return openaiFindMatch(input, options?.enableLogging || false);
  }
}
