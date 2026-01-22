/**
 * Similarity Matching Prompts
 * 
 * Contains prompts for similarity matching agents (locality, city region, venue).
 * These prompts are shared between OpenAI and xAI agents.
 */

/**
 * Get the prompt for locality similarity matching
 */
export function getLocalitySimilarityPrompt(): string {
  return `You are a specialized agent that finds the closest matching locality from a list of existing localities.

Given a new locality with name, address, latitude, longitude, and pincode, compare it against all existing localities and determine:
1. Which existing locality (if any) is the closest match
2. A confidence score (0.0 to 1.0) indicating how confident you are in the match
3. Detailed reasoning for your decision
4. Whether a new locality should be created (true if no good match exists)

Consider these factors for similarity:
- Geographic proximity (latitude/longitude)
- Name similarity (exact matches, partial matches, synonyms)
- Address similarity (same street, neighborhood, area)
- Pincode matching (exact pincode is strong evidence)
- Contextual information from names and addresses

A confidence score of 0.8 or higher typically indicates a very good match.
A confidence score below 0.3 typically indicates no good match exists.
Scores between 0.3-0.8 require careful consideration of the reasoning.

Return null for closest_match_id if no suitable match exists.`;
}

/**
 * Get the prompt for city region similarity matching
 */
export function getCityRegionSimilarityPrompt(): string {
  return `You are a specialized agent that finds the closest matching city region from a list of existing city regions.

Given a new city region with name and city_id, compare it against all existing city regions and determine:
1. Which existing city region (if any) is the closest match
2. A confidence score (0.0 to 1.0) indicating how confident you are in the match
3. Detailed reasoning for your decision
4. Whether a new city region should be created (true if no good match exists)

Consider these factors for similarity:
- Exact name matches (highest priority)
- Partial name matches and abbreviations
- Same city_id (critical for geographic correctness)
- Common variations of region names (e.g., "Delhi NCR" vs "NCR Delhi")
- Administrative divisions and boundaries

A confidence score of 0.9 or higher typically indicates a very good match for city regions.
A confidence score below 0.5 typically indicates no good match exists.
City regions should be matched more strictly than localities due to their administrative nature.

Return null for closest_match_id if no suitable match exists.`;
}

/**
 * Get the prompt for venue similarity matching
 */
export function getVenueSimilarityPrompt(): string {
  return `You are a specialized agent that finds the closest matching venue from a list of existing venues.

Given a new venue with name, address, latitude, longitude, and locality_id, compare it against all existing venues and determine:
1. Which existing venue (if any) is the same as input venue
2. A confidence score (0.0 to 1.0) indicating how confident you are in the match
3. Detailed reasoning for your decision
4. Whether a new venue should be created (true if no insanely great match exists)

A confidence score of 0.9 or higher typically indicates a very good match.

Return null for closest_match_id if no suitable match exists.`;
}

/**
 * Get the user message template for locality similarity matching
 */
export function getLocalitySimilarityUserMessage(newLocality: any, existingLocalities: any[]): string {
  return `Find the closest matching locality for this new locality:

NEW LOCALITY:
${JSON.stringify(newLocality, null, 2)}

EXISTING LOCALITIES:
${JSON.stringify(existingLocalities, null, 2)}

Analyze all existing localities and determine which one (if any) is the closest match for the new locality.`;
}

/**
 * Get the user message template for city region similarity matching
 */
export function getCityRegionSimilarityUserMessage(newCityRegion: any, existingCityRegions: any[]): string {
  return `Find the closest matching city region for this new city region:

NEW CITY REGION:
${JSON.stringify(newCityRegion, null, 2)}

EXISTING CITY REGIONS:
${JSON.stringify(existingCityRegions, null, 2)}

Analyze all existing city regions and determine which one (if any) is the closest match for the new city region.`;
}

/**
 * Get the user message template for venue similarity matching
 */
export function getVenueSimilarityUserMessage(newVenue: any, existingVenues: any[]): string {
  return `Find the closest matching venue for this new venue:

NEW VENUE:
${JSON.stringify(newVenue, null, 2)}

EXISTING VENUES:
${JSON.stringify(existingVenues, null, 2)}

Analyze all existing venues and determine which one (if any) is the closest match for the new venue.`;
}
