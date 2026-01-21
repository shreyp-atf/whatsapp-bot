/**
 * Venue Agent with Database Integration
 *
 * This module provides an OpenAI agent that generates venue, locality, and city region data
 * based on venue name input, with automatic database insertion and similarity matching.
 */

import { webSearchTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { z } from "zod";
import dotenv from 'dotenv';
import {
  findClosestLocalityMatch,
  findClosestCityRegionMatch,
  findClosestVenueMatch,
  type LocalitySimilarityInput,
  type CityRegionSimilarityInput,
  type VenueSimilarityInput
} from './similarityAgent';
import { getAllLocalities } from '../db/locality';
import { getAllCityRegions } from '../db/cityRegion';
import { getAllVenues } from '../db/venue';
import { getAllCities, getCityByNameAndCountry, createCity } from '../db/city';
import { createLocality } from '../db/locality';
import { createCityRegion } from '../db/cityRegion';
import { createVenue } from '../db/venue';
import { PoolClient } from 'pg';

dotenv.config();

// Tool definitions
const webSearchPreview = webSearchTool({
  searchContextSize: "medium",
  userLocation: {
    city: "Gurugram",
    country: "IN",
    region: "Haryana",
    type: "approximate"
  }
});

// Schema for venue row generation
const VenueRowSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  google_maps_location: z.string().min(1),
  directions_to_reach: z.string().nullable(),
  address: z.string().min(1),
  is_public: z.boolean().default(false),
  is_active: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  is_approved: z.boolean().default(false),
  price_point: z.number().min(1).max(5).nullable(),
  open_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  type: z.string().min(1),
  research_notes: z.string().min(1)
});

// Schema for locality row generation
const LocalityRowSchema = z.object({
  name: z.string().min(1),
  pincode: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  city_name: z.string().min(1),
  city_region_name: z.string().min(1),
  research_notes: z.string().min(1)
});

// Schema for city region row generation
const CityRegionRowSchema = z.object({
  name: z.string().min(1),
  city_name: z.string().min(1),
  research_notes: z.string().min(1)
});

// Main output schema combining venue, locality, and city region data
const VenueLocalityAgentSchema = z.object({
  venue_row: VenueRowSchema,
  locality_row: LocalityRowSchema,
  city_region_row: CityRegionRowSchema
});

// Create the venue agent with web search capabilities
const venueLocalityAgent = new Agent({
  name: "Venue Locality Generator Agent",
  instructions: `You are a specialized agent that generates complete venue, locality, and city region database rows based on venue name input.

Your task is to:
1. Research the venue using web search to find accurate details
2. Generate city region information (e.g., "Delhi NCR", "Mumbai Metropolitan")
3. Generate locality information (neighborhood/area within the city region)
4. Generate venue details

For the city region row, you need to:
- Determine the city region name based on the venue location
- Identify the main city (e.g., "Delhi" for "Delhi NCR", "Mumbai" for "Mumbai Metropolitan")
- Include research notes explaining your sources and reasoning

For the locality row, you need to:
- Extract or infer the locality name (neighborhood/area within the city region)
- Find the pincode for the area
- Get the address of the locality/area
- Determine latitude/longitude coordinates for the locality
- Identify the city region it belongs to
- Include research notes explaining your sources and reasoning

For the venue row, you need to:
- Use the provided venue name
- Find accurate latitude/longitude coordinates
- Generate or find a Google Maps location URL
- Get detailed address information
- Determine the venue type (e.g., "restaurant", "cafe", "bar", "theater", "stadium", "park", "mall", "hotel", "museum", "gallery", "club", "venue", "hall", "arena", "auditorium", etc.) - this is REQUIRED
- Set default boolean flags (is_public=false, is_active=false, is_verified=false, is_approved=false)
- Determine price point (1-5 scale, where 1 is budget and 5 is luxury, null if unknown)
- Find typical operating hours (open_time and close_time in HH:MM format)
- Include research notes explaining your sources and reasoning

Use the websearchpreview tool to:
- Search for venue details, reviews, and official websites
- Find coordinates and maps information
- Research locality information and boundaries
- Get accurate address and operating hours
- Cross-reference information from multiple sources

Ensure all data is accurate and suitable for database insertion.`,
  model: "gpt-5-nano",
  tools: [
    webSearchPreview
  ],
  outputType: VenueLocalityAgentSchema,
  modelSettings: {
    reasoning: {
      effort: "low"
    },
    store: true
  }
});

type VenueAgentInput = {
  venue_name: string;
};

// Database operation results
type DatabaseOperationResult = {
  city_id: number;
  city_region_id: number;
  locality_id: number;
  venue_id: number;
  created_new_city: boolean;
  created_new_city_region: boolean;
  created_new_locality: boolean;
  created_new_venue: boolean;
};

// Main workflow function
export const runVenueLocalityWorkflow = async (
  input: VenueAgentInput,
  enableLogging: boolean = false
): Promise<{
  output_text: string;
  output_parsed: z.infer<typeof VenueLocalityAgentSchema>;
}> => {
  return await withTrace("Venue Locality Generation with DB", async () => {
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [{
          type: "input_text",
          text: `Generate venue, locality, and city region database rows for:

Venue Name: ${input.venue_name}

Please research this venue and generate complete rows for venue, locality, and city region tables.
Focus on finding accurate geographic information, addresses, and operational details.`
        }]
      }
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "venue-locality-agent",
        venue_name: input.venue_name,
        timestamp: new Date().toISOString()
      }
    });

    const result = await runner.run(
      venueLocalityAgent,
      conversationHistory
    );

    if (!result.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    // Note: Database operations will be performed within a transaction in the calling code
    // This function only returns the agent output
    return {
      output_text: JSON.stringify(result.finalOutput, null, 2),
      output_parsed: result.finalOutput
    };
  });
};

/**
 * Perform database operations with similarity matching within a transaction
 * This should be called within a transaction context
 */
export const performVenueDatabaseOperations = async (
  agentOutput: z.infer<typeof VenueLocalityAgentSchema>,
  client: PoolClient,
  enableLogging: boolean = false
): Promise<DatabaseOperationResult> => {
  return performDatabaseOperations(agentOutput, client, enableLogging);
};

// Helper function to perform database operations with similarity matching
async function performDatabaseOperations(
  agentOutput: z.infer<typeof VenueLocalityAgentSchema>,
  client?: PoolClient,
  enableLogging: boolean = false
): Promise<DatabaseOperationResult> {
  const { venue_row, locality_row, city_region_row } = agentOutput;

  let cityId: number;
  let createdNewCity = false;

  // 1. Handle City
  const existingCity = await getCityByNameAndCountry(city_region_row.city_name, 'India', client);
  if (existingCity) {
    cityId = existingCity.city_id;
  } else {
    // Create new city
    const newCity = await createCity({
      name: city_region_row.city_name,
      country: 'India'
    }, client);
    cityId = newCity.city_id;
    createdNewCity = true;
  }

  // 2. Handle City Region with similarity matching
  const existingCityRegions = await getAllCityRegions();
  const cityRegionSimilarityInput: CityRegionSimilarityInput = {
    new_city_region: {
      name: city_region_row.name,
      city_id: cityId
    },
    existing_city_regions: existingCityRegions.map(cr => ({
      city_region_id: cr.city_region_id,
      name: cr.name,
      city_id: cr.city_id
    }))
  };

  const cityRegionMatchStart = enableLogging ? Date.now() : 0;
  const cityRegionMatch = await findClosestCityRegionMatch(cityRegionSimilarityInput, enableLogging);
  if (enableLogging) {
    const cityRegionMatchTime = Date.now() - cityRegionMatchStart;
    console.log(`    [LLM Timing] City Region Similarity: ${cityRegionMatchTime}ms`);
    console.log(`    [LLM Response] City Region Similarity:`, JSON.stringify(cityRegionMatch, null, 2));
  }

  let cityRegionId: number;
  let createdNewCityRegion = false;

  if (cityRegionMatch.closest_match_id && cityRegionMatch.confidence_score >= 0.8) {
    cityRegionId = cityRegionMatch.closest_match_id;
  } else {
    // Create new city region
    const newCityRegion = await createCityRegion({
      city_id: cityId,
      name: city_region_row.name
    }, client);
    cityRegionId = newCityRegion.city_region_id;
    createdNewCityRegion = true;
  }

  // 3. Handle Locality with similarity matching
  const existingLocalities = await getAllLocalities();
  const localitySimilarityInput: LocalitySimilarityInput = {
    new_locality: {
      name: locality_row.name,
      address: locality_row.address,
      latitude: locality_row.latitude,
      longitude: locality_row.longitude,
      pincode: locality_row.pincode
    },
    existing_localities: existingLocalities.map(l => ({
      locality_id: l.locality_id,
      name: l.name,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
      pincode: l.pincode
    }))
  };

  const localityMatchStart = enableLogging ? Date.now() : 0;
  const localityMatch = await findClosestLocalityMatch(localitySimilarityInput, enableLogging);
  if (enableLogging) {
    const localityMatchTime = Date.now() - localityMatchStart;
    console.log(`    [LLM Timing] Locality Similarity: ${localityMatchTime}ms`);
    console.log(`    [LLM Response] Locality Similarity:`, JSON.stringify(localityMatch, null, 2));
  }

  let localityId: number;
  let createdNewLocality = false;

  if (localityMatch.closest_match_id && localityMatch.confidence_score >= 0.8) {
    localityId = localityMatch.closest_match_id;
  } else {
    // Create new locality
    const newLocality = await createLocality({
      name: locality_row.name,
      pincode: locality_row.pincode,
      address: locality_row.address,
      latitude: locality_row.latitude,
      longitude: locality_row.longitude,
      city_region_id: cityRegionId
    }, client);
    localityId = newLocality.locality_id;
    createdNewLocality = true;
  }

  // 4. Handle Venue with similarity matching
  const existingVenues = await getAllVenues();
  const venueSimilarityInput: VenueSimilarityInput = {
    new_venue: {
      name: venue_row.name,
      address: venue_row.address,
      latitude: venue_row.latitude,
      longitude: venue_row.longitude,
      locality_id: localityId
    },
    existing_venues: existingVenues.map(v => ({
      venue_id: v.venue_id,
      name: v.name,
      address: v.address,
      latitude: v.latitude,
      longitude: v.longitude,
      locality_id: v.locality_id
    }))
  };

  const venueMatchStart = enableLogging ? Date.now() : 0;
  const venueMatch = await findClosestVenueMatch(venueSimilarityInput, enableLogging);
  if (enableLogging) {
    const venueMatchTime = Date.now() - venueMatchStart;
    console.log(`    [LLM Timing] Venue Similarity: ${venueMatchTime}ms`);
    console.log(`    [LLM Response] Venue Similarity:`, JSON.stringify(venueMatch, null, 2));
  }

  let venueId: number;
  let createdNewVenue = false;

  if (venueMatch.closest_match_id && venueMatch.confidence_score >= 0.9) {
    venueId = venueMatch.closest_match_id;
  } else {
    // Create new venue
    const newVenue = await createVenue({
      name: venue_row.name,
      latitude: venue_row.latitude,
      longitude: venue_row.longitude,
      google_maps_location: venue_row.google_maps_location,
      directions_to_reach: venue_row.directions_to_reach,
      address: venue_row.address,
      is_public: venue_row.is_public,
      is_active: venue_row.is_active,
      is_verified: venue_row.is_verified,
      is_approved: venue_row.is_approved,
      price_point: venue_row.price_point,
      open_time: venue_row.open_time,
      close_time: venue_row.close_time,
      locality_id: localityId,
      type: venue_row.type
    }, client);
    venueId = newVenue.venue_id;
    createdNewVenue = true;
  }

  return {
    city_id: cityId,
    city_region_id: cityRegionId,
    locality_id: localityId,
    venue_id: venueId,
    created_new_city: createdNewCity,
    created_new_city_region: createdNewCityRegion,
    created_new_locality: createdNewLocality,
    created_new_venue: createdNewVenue
  };
}