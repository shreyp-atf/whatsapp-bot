/**
 * Similarity Matching Agent
 *
 * This module provides an agent that finds the closest matches for localities, city regions, and venues
 * from database records using LLM-based similarity comparison.
 */

import { Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { z } from "zod";
import dotenv from 'dotenv';

dotenv.config();

// Schema for locality similarity matching
const LocalitySimilaritySchema = z.object({
  closest_match_id: z.number().nullable(),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  should_create_new: z.boolean()
});

// Schema for city region similarity matching
const CityRegionSimilaritySchema = z.object({
  closest_match_id: z.number().nullable(),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  should_create_new: z.boolean()
});

// Schema for venue similarity matching
const VenueSimilaritySchema = z.object({
  closest_match_id: z.number().nullable(),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  should_create_new: z.boolean()
});

// Create the locality similarity agent
const localitySimilarityAgent = new Agent({
  name: "Locality Similarity Matching Agent",
  instructions: `You are a specialized agent that finds the closest matching locality from a list of existing localities.

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

Return null for closest_match_id if no suitable match exists.`,
  model: "gpt-5-nano",
  tools: [],
  outputType: LocalitySimilaritySchema,
  modelSettings: {
    reasoning: {
      effort: "low"
    },
    store: true
  }
});

// Create the city region similarity agent
const cityRegionSimilarityAgent = new Agent({
  name: "City Region Similarity Matching Agent",
  instructions: `You are a specialized agent that finds the closest matching city region from a list of existing city regions.

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

Return null for closest_match_id if no suitable match exists.`,
  model: "gpt-5-nano",
  tools: [],
  outputType: CityRegionSimilaritySchema,
  modelSettings: {
    reasoning: {
      effort: "low"
    },
    store: true
  }
});

// Create the venue similarity agent
const venueSimilarityAgent = new Agent({
  name: "Venue Similarity Matching Agent",
  instructions: `You are a specialized agent that finds the closest matching venue from a list of existing venues.

Given a new venue with name, address, latitude, longitude, and locality_id, compare it against all existing venues and determine:
1. Which existing venue (if any) is the same as input venue
2. A confidence score (0.0 to 1.0) indicating how confident you are in the match
3. Detailed reasoning for your decision
4. Whether a new venue should be created (true if no insanely great match exists)

A confidence score of 0.9 or higher typically indicates a very good match.

Return null for closest_match_id if no suitable match exists.`,
  model: "gpt-5-nano",
  tools: [],
  outputType: VenueSimilaritySchema,
  modelSettings: {
    reasoning: {
      effort: "low"
    },
    store: true
  }
});

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

// Similarity matching functions
export const findClosestLocalityMatch = async (
  input: LocalitySimilarityInput,
  enableLogging: boolean = false
) => {
  return await withTrace("Locality Similarity Match", async () => {
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [{
          type: "input_text",
          text: `Find the closest matching locality for this new locality:

NEW LOCALITY:
${JSON.stringify(input.new_locality, null, 2)}

EXISTING LOCALITIES:
${JSON.stringify(input.existing_localities, null, 2)}

Analyze all existing localities and determine which one (if any) is the closest match for the new locality.`
        }]
      }
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "locality-similarity-agent",
        new_locality_name: input.new_locality.name
      }
    });

    const result = await runner.run(
      localitySimilarityAgent,
      conversationHistory
    );

    if (!result.finalOutput) {
      throw new Error("Similarity matching agent result is undefined");
    }

    return result.finalOutput;
  });
};

export const findClosestCityRegionMatch = async (
  input: CityRegionSimilarityInput,
  enableLogging: boolean = false
) => {
  return await withTrace("City Region Similarity Match", async () => {
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [{
          type: "input_text",
          text: `Find the closest matching city region for this new city region:

NEW CITY REGION:
${JSON.stringify(input.new_city_region, null, 2)}

EXISTING CITY REGIONS:
${JSON.stringify(input.existing_city_regions, null, 2)}

Analyze all existing city regions and determine which one (if any) is the closest match for the new city region.`
        }]
      }
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "city-region-similarity-agent",
        new_city_region_name: input.new_city_region.name
      }
    });

    const result = await runner.run(
      cityRegionSimilarityAgent,
      conversationHistory
    );

    if (!result.finalOutput) {
      throw new Error("Similarity matching agent result is undefined");
    }

    return result.finalOutput;
  });
};

export const findClosestVenueMatch = async (
  input: VenueSimilarityInput,
  enableLogging: boolean = false
) => {
  return await withTrace("Venue Similarity Match", async () => {
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [{
          type: "input_text",
          text: `Find the closest matching venue for this new venue:

NEW VENUE:
${JSON.stringify(input.new_venue, null, 2)}

EXISTING VENUES:
${JSON.stringify(input.existing_venues, null, 2)}

Analyze all existing venues and determine which one (if any) is the closest match for the new venue.`
        }]
      }
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "venue-similarity-agent",
        new_venue_name: input.new_venue.name
      }
    });

    const result = await runner.run(
      venueSimilarityAgent,
      conversationHistory
    );

    if (!result.finalOutput) {
      throw new Error("Similarity matching agent result is undefined");
    }

    return result.finalOutput;
  });
};