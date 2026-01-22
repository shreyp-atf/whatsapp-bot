/**
 * Agent Definitions
 * 
 * Provider-agnostic agent definitions. All agent logic (instructions, prompts, schemas)
 * is defined here. Provider-specific execution is handled by agentExecutor files in
 * openai/ and xai/ folders.
 */

import { z } from 'zod';
import {
  CityRowSchema,
  CityRegionRowSchema,
  LocalityRowSchema,
  VenueRowSchema,
  ActivityRowSchema,
  ActivityVenueMapRowSchema,
  VenueLocalityAgentSchema,
  EventLinkValidationSchema,
  EventCategoryClassificationSchema,
  MovieExtractionSchema,
  GokartingExtractionSchema,
  type EventCategory
} from '../schemas';
import {
  getCityExtractionPrompt,
  getCityExtractionUserMessage,
  getCityRegionExtractionPrompt,
  getCityRegionExtractionUserMessage,
  getLocalityExtractionPrompt,
  getLocalityExtractionUserMessage,
  getVenueFromUrlExtractionPrompt,
  getVenueFromUrlExtractionUserMessage,
  getActivityExtractionPrompt,
  getActivityExtractionUserMessage,
  getActivityVenueMapExtractionPrompt,
  getActivityVenueMapExtractionUserMessage,
  getEventLinkValidationPrompt,
  getEventLinkValidationUserMessage,
  getEventCategoryClassificationPrompt,
  getEventCategoryClassificationUserMessage,
  getMovieExtractionPrompt,
  getMovieExtractionUserMessage,
  getGokartingExtractionPrompt,
  getGokartingExtractionUserMessage,
  getVenueExtractionPrompt,
  getVenueExtractionUserMessage
} from '../extractionPrompts';
import {
  LocalitySimilaritySchema,
  CityRegionSimilaritySchema,
  VenueSimilaritySchema
} from '../schemas';
import {
  getLocalitySimilarityPrompt,
  getCityRegionSimilarityPrompt,
  getVenueSimilarityPrompt,
  getLocalitySimilarityUserMessage,
  getCityRegionSimilarityUserMessage,
  getVenueSimilarityUserMessage
} from '../similarityPrompts';

/**
 * Agent definition interface
 * This is provider-agnostic - contains all information needed to execute an agent
 */
export interface AgentDefinition<TInput, TOutput> {
  /** Unique identifier for the agent */
  id: string;
  /** Human-readable name */
  name: string;
  /** Zod schema for output validation */
  schema: z.ZodSchema<TOutput>;
  /** Function to get instructions/prompt for the agent */
  getInstructions: () => string;
  /** Function to build user message from input */
  buildUserMessage: (input: TInput) => string;
  /** Optional: Custom input validation */
  validateInput?: (input: TInput) => boolean;
  /** Optional: Default model name (provider-specific) */
  defaultModel?: string;
}

/**
 * Agent Registry
 * All agents are registered here with their definitions
 */

// City Agent
export const cityAgentDefinition: AgentDefinition<{ url: string }, z.infer<typeof CityRowSchema>> = {
  id: 'city',
  name: 'City Extraction Agent',
  schema: CityRowSchema,
  getInstructions: () => getCityExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract city information.',
  buildUserMessage: (input) => getCityExtractionUserMessage(input.url),
  defaultModel: 'grok-4-fast'
};

// City Region Agent
export const cityRegionAgentDefinition: AgentDefinition<{ url: string; city_id: number; city_name: string }, z.infer<typeof CityRegionRowSchema>> = {
  id: 'city-region',
  name: 'City Region Extraction Agent',
  schema: CityRegionRowSchema,
  getInstructions: () => getCityRegionExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract city region information.',
  buildUserMessage: (input) => getCityRegionExtractionUserMessage(input.url, input.city_name),
  defaultModel: 'grok-4-fast'
};

// Locality Agent
export const localityAgentDefinition: AgentDefinition<{ url: string; city_region_id: number; city_region_name: string }, z.infer<typeof LocalityRowSchema>> = {
  id: 'locality',
  name: 'Locality Extraction Agent',
  schema: LocalityRowSchema,
  getInstructions: () => getLocalityExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract locality information.',
  buildUserMessage: (input) => getLocalityExtractionUserMessage(input.url, input.city_region_name),
  defaultModel: 'grok-4-fast'
};

// Venue Agent
export const venueAgentDefinition: AgentDefinition<{ url: string; locality_id: number; locality_name: string }, z.infer<typeof VenueRowSchema>> = {
  id: 'venue',
  name: 'Venue Extraction Agent',
  schema: VenueRowSchema,
  getInstructions: () => getVenueFromUrlExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract venue information.',
  buildUserMessage: (input) => getVenueFromUrlExtractionUserMessage(input.url, input.locality_name),
  defaultModel: 'grok-4-fast'
};

// Activity Agent
export const activityAgentDefinition: AgentDefinition<{ url: string }, z.infer<typeof ActivityRowSchema>> = {
  id: 'activity',
  name: 'Activity Extraction Agent',
  schema: ActivityRowSchema,
  getInstructions: () => getActivityExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract activity information.',
  buildUserMessage: (input) => getActivityExtractionUserMessage(input.url),
  defaultModel: 'grok-4-fast'
};

// Activity Venue Map Agent
export const activityVenueMapAgentDefinition: AgentDefinition<{ url: string; activity_id: number; activity_name: string; venue_id: number; venue_name: string }, z.infer<typeof ActivityVenueMapRowSchema>> = {
  id: 'activity-venue-map',
  name: 'Activity Venue Map Extraction Agent',
  schema: ActivityVenueMapRowSchema,
  getInstructions: () => getActivityVenueMapExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL to extract event information.',
  buildUserMessage: (input) => getActivityVenueMapExtractionUserMessage(input.url, input.activity_name, input.venue_name),
  defaultModel: 'grok-4-fast'
};

// Event Link Validator Agent
export const eventLinkValidatorAgentDefinition: AgentDefinition<{ url: string }, z.infer<typeof EventLinkValidationSchema>> = {
  id: 'event-link-validator',
  name: 'Event Link Validator Agent',
  schema: EventLinkValidationSchema,
  getInstructions: () => getEventLinkValidationPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly.',
  buildUserMessage: (input) => getEventLinkValidationUserMessage(input.url),
  defaultModel: 'grok-4-fast'
};

// Event Category Classifier Agent
export const eventCategoryClassifierAgentDefinition: AgentDefinition<{ url: string; available_categories?: EventCategory[] }, z.infer<typeof EventCategoryClassificationSchema>> = {
  id: 'event-category-classifier',
  name: 'Event Category Classifier Agent',
  schema: EventCategoryClassificationSchema,
  getInstructions: () => getEventCategoryClassificationPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly to determine the most appropriate category.',
  buildUserMessage: (input) => getEventCategoryClassificationUserMessage(input.url, input.available_categories),
  defaultModel: 'grok-4-fast'
};

// Movie Agent
export const movieAgentDefinition: AgentDefinition<{ url: string }, z.infer<typeof MovieExtractionSchema>> = {
  id: 'movie',
  name: 'Movie Extraction Agent',
  schema: MovieExtractionSchema,
  getInstructions: () => getMovieExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly to extract all movie-related information.',
  buildUserMessage: (input) => getMovieExtractionUserMessage(input.url),
  defaultModel: 'grok-4-fast'
};

// Gokarting Agent
export const gokartingAgentDefinition: AgentDefinition<{ url: string }, z.infer<typeof GokartingExtractionSchema>> = {
  id: 'gokarting',
  name: 'Gokarting Extraction Agent',
  schema: GokartingExtractionSchema,
  getInstructions: () => getGokartingExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly to extract all gokarting-related information.',
  buildUserMessage: (input) => getGokartingExtractionUserMessage(input.url),
  defaultModel: 'grok-4-fast'
};

// Similarity Agent Input Types
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

// Locality Similarity Agent
export const localitySimilarityAgentDefinition: AgentDefinition<LocalitySimilarityInput, z.infer<typeof LocalitySimilaritySchema>> = {
  id: 'locality-similarity',
  name: 'Locality Similarity Matching Agent',
  schema: LocalitySimilaritySchema,
  getInstructions: () => getLocalitySimilarityPrompt(),
  buildUserMessage: (input) => getLocalitySimilarityUserMessage(input.new_locality, input.existing_localities),
  defaultModel: 'grok-4-fast'
};

// City Region Similarity Agent
export const cityRegionSimilarityAgentDefinition: AgentDefinition<CityRegionSimilarityInput, z.infer<typeof CityRegionSimilaritySchema>> = {
  id: 'city-region-similarity',
  name: 'City Region Similarity Matching Agent',
  schema: CityRegionSimilaritySchema,
  getInstructions: () => getCityRegionSimilarityPrompt(),
  buildUserMessage: (input) => getCityRegionSimilarityUserMessage(input.new_city_region, input.existing_city_regions),
  defaultModel: 'grok-4-fast'
};

// Venue Similarity Agent
export const venueSimilarityAgentDefinition: AgentDefinition<VenueSimilarityInput, z.infer<typeof VenueSimilaritySchema>> = {
  id: 'venue-similarity',
  name: 'Venue Similarity Matching Agent',
  schema: VenueSimilaritySchema,
  getInstructions: () => getVenueSimilarityPrompt(),
  buildUserMessage: (input) => getVenueSimilarityUserMessage(input.new_venue, input.existing_venues),
  defaultModel: 'grok-4-fast'
};

// Venue Locality Agent (for venue name input, outputs venue + locality + city region)
export interface VenueLocalityAgentInput {
  venue_name: string;
  locality?: string;
  details?: string;
  booking_link?: string;
}

export const venueLocalityAgentDefinition: AgentDefinition<VenueLocalityAgentInput, z.infer<typeof VenueLocalityAgentSchema>> = {
  id: 'venue-locality',
  name: 'Venue Locality Generator Agent',
  schema: VenueLocalityAgentSchema,
  getInstructions: () => getVenueExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to research the venue and find accurate details.\n\nIMPORTANT: When input fields are provided (booking_link, details/notes, locality), you MUST use them exactly as provided. When fields are NOT provided or are null/empty, you MUST research and determine them yourself.',
  buildUserMessage: (input) => {
    const baseMessage = getVenueExtractionUserMessage(input.venue_name);
    const additionalInfo = [
      input.locality ? `Locality: ${input.locality} (USE THIS EXACT VALUE)` : 'Locality: [NOT PROVIDED - research and determine]',
      input.details ? `Details/Notes: ${input.details} (USE THIS EXACT VALUE)` : 'Details/Notes: [NOT PROVIDED - research and determine]',
      input.booking_link ? `Booking Link: ${input.booking_link} (USE THIS EXACT VALUE)` : 'Booking Link: [NOT PROVIDED - research and determine]'
    ].join('\n');
    return `${baseMessage}\n\nAdditional Information:\n${additionalInfo}`;
  },
  defaultModel: 'grok-4-fast'
};

/**
 * Agent registry - maps agent IDs to their definitions
 */
export const AGENT_REGISTRY = {
  'city': cityAgentDefinition,
  'city-region': cityRegionAgentDefinition,
  'locality': localityAgentDefinition,
  'venue': venueAgentDefinition,
  'activity': activityAgentDefinition,
  'activity-venue-map': activityVenueMapAgentDefinition,
  'event-link-validator': eventLinkValidatorAgentDefinition,
  'event-category-classifier': eventCategoryClassifierAgentDefinition,
  'movie': movieAgentDefinition,
  'gokarting': gokartingAgentDefinition,
  'locality-similarity': localitySimilarityAgentDefinition,
  'city-region-similarity': cityRegionSimilarityAgentDefinition,
  'venue-similarity': venueSimilarityAgentDefinition
} as const;

export type AgentId = keyof typeof AGENT_REGISTRY;

/**
 * Get agent definition by ID
 */
export function getAgentDefinition<TId extends AgentId>(id: TId): typeof AGENT_REGISTRY[TId] {
  return AGENT_REGISTRY[id];
}

/**
 * Get all agent definitions
 */
export function getAllAgentDefinitions(): typeof AGENT_REGISTRY {
  return AGENT_REGISTRY;
}
