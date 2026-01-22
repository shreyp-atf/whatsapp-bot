/**
 * Similarity Matching Agent
 *
 * This module provides an agent that finds the closest matches for localities, city regions, and venues
 * from database records using LLM-based similarity comparison.
 */

import { Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import dotenv from 'dotenv';
import {
  LocalitySimilaritySchema,
  CityRegionSimilaritySchema,
  VenueSimilaritySchema
} from '../utils/schemas';
import {
  getLocalitySimilarityPrompt,
  getCityRegionSimilarityPrompt,
  getVenueSimilarityPrompt,
  getLocalitySimilarityUserMessage,
  getCityRegionSimilarityUserMessage,
  getVenueSimilarityUserMessage
} from '../utils/similarityPrompts';

dotenv.config();

// Create the locality similarity agent
const localitySimilarityAgent = new Agent({
  name: "Locality Similarity Matching Agent",
  instructions: getLocalitySimilarityPrompt(),
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
  instructions: getCityRegionSimilarityPrompt(),
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
  instructions: getVenueSimilarityPrompt(),
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
          text: getLocalitySimilarityUserMessage(input.new_locality, input.existing_localities)
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
          text: getCityRegionSimilarityUserMessage(input.new_city_region, input.existing_city_regions)
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
          text: getVenueSimilarityUserMessage(input.new_venue, input.existing_venues)
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