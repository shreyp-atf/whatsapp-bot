/**
 * xAI Agents Orchestrator
 *
 * This module provides the main orchestration for xAI-based URL processing pipeline.
 * It coordinates all xAI agents to extract and create database entities from URLs.
 */

import { Pipeline, createUrlProcessingPipeline } from '../utils/pipeline';
import { executeAgentWithTransaction } from '../utils/transactionWrapper';
import { xaiAgentLogger as logger } from '../utils/logging';
import { classifyError } from '../utils/errorHandling';
import { findOrCreateWithSimilarity, findOrCreate } from '../utils/dbOperations';
import { withTransaction } from '../../db/connection';
import { 
  getCityByNameAndCountry, 
  getAllCities, 
  createCity 
} from '../../db/city';
import { 
  getCityRegionsByCityId, 
  getAllCityRegions, 
  createCityRegion 
} from '../../db/cityRegion';
import { 
  getLocalitiesByCityRegionId, 
  getAllLocalities, 
  createLocality 
} from '../../db/locality';
import { 
  getVenuesByLocalityId, 
  getAllVenues, 
  createVenue 
} from '../../db/venue';
import { 
  searchActivitiesByName, 
  getAllActivities, 
  createActivity 
} from '../../db/activity';
import { createActivityVenueMap } from '../../db/activityVenueMap';

// Import xAI agents
import { xaiCityAgent } from './cityAgent';
import { xaiCityRegionAgent } from './cityRegionAgent';
import { xaiLocalityAgent } from './localityAgent';
import { xaiVenueAgent } from './venueAgent';
import { xaiActivityAgent } from './activityAgent';
import { xaiActivityVenueMapAgent } from './activityVenueMapAgent';
import { xaiEventLinkValidatorAgent, validateEventLink } from './eventLinkValidatorAgent';
import { xaiEventCategoryClassifierAgent, classifyEventCategory } from './eventCategoryClassifierAgent';
import { xaiMovieAgent, extractMovieInformation } from './movieAgent';
import { xaiGokartingAgent, extractGokartingInformation } from './gokartingAgent';
import { getEventCategoryConfig, hasSpecializedAgent } from '../utils/eventCategoryConfig';
import { getXaiEventCategoryConfig, hasXaiSpecializedAgent } from './eventCategoryConfig';

// Import xAI similarity matchers
import {
  findClosestLocalityMatch,
  findClosestCityRegionMatch,
  findClosestVenueMatch
} from './similarityAgent';
import { SimilarityMatcher } from '../utils/dbOperations';
import type { Locality, CityRegion, Venue } from '../../types/database';
import type { LocalityRow, VenueRow } from '../utils/schemas';

/**
 * Create similarity matcher wrappers for xAI agents
 */
const localitySimilarityMatcher: SimilarityMatcher<LocalityRow, Locality> = {
  async findClosestMatch(newLocality, existingLocalities, options) {
    const result = await findClosestLocalityMatch(
      {
        new_locality: {
          name: newLocality.name,
          address: newLocality.address,
          latitude: newLocality.latitude,
          longitude: newLocality.longitude,
          pincode: newLocality.pincode
        },
        existing_localities: existingLocalities.map(loc => ({
          locality_id: loc.locality_id,
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          pincode: loc.pincode
        }))
      },
      options?.enableLogging || false
    );
    return result;
  }
};

const cityRegionSimilarityMatcher: SimilarityMatcher<{ name: string; city_id: number }, CityRegion> = {
  async findClosestMatch(newCityRegion, existingCityRegions, options) {
    const result = await findClosestCityRegionMatch(
      {
        new_city_region: {
          name: newCityRegion.name,
          city_id: newCityRegion.city_id
        },
        existing_city_regions: existingCityRegions.map(cr => ({
          city_region_id: cr.city_region_id,
          name: cr.name,
          city_id: cr.city_id
        }))
      },
      options?.enableLogging || false
    );
    return result;
  }
};

const venueSimilarityMatcher: SimilarityMatcher<VenueRow & { locality_id: number }, Venue> = {
  async findClosestMatch(newVenue, existingVenues, options) {
    const result = await findClosestVenueMatch(
      {
        new_venue: {
          name: newVenue.name,
          address: newVenue.address,
          latitude: newVenue.latitude,
          longitude: newVenue.longitude,
          locality_id: newVenue.locality_id
        },
        existing_venues: existingVenues.map(ven => ({
          venue_id: ven.venue_id,
          name: ven.name,
          address: ven.address,
          latitude: ven.latitude,
          longitude: ven.longitude,
          locality_id: ven.locality_id
        }))
      },
      options?.enableLogging || false
    );
    return result;
  }
};

// Pipeline result interface
export interface UrlProcessingResult {
  success: boolean;
  city_id?: number;
  city_region_id?: number;
  locality_id?: number;
  venue_id?: number;
  activity_id?: number;
  activity_venue_map_id?: number;
  created_new_city?: boolean;
  created_new_city_region?: boolean;
  created_new_locality?: boolean;
  created_new_venue?: boolean;
  created_new_activity?: boolean;
  error?: Error;
  executionTime: number;
  // New fields for event validation and categorization
  is_event_link?: boolean;
  event_category?: EventCategory;
  category_confidence?: number;
  specialized_extraction?: any; // Results from specialized agents (movie, gokarting, etc.)
}

/**
 * Run the complete URL processing pipeline using xAI agents
 * This processes a URL through all agents sequentially to create database entities
 */
export async function runUrlProcessingPipeline(
  url: string,
  options: {
    enableLogging?: boolean;
    enableTracing?: boolean;
    maxRetries?: number;
  } = {}
): Promise<UrlProcessingResult> {
  const startTime = Date.now();
  const { enableLogging = true, enableTracing = true, maxRetries = 2 } = options;

  logger.info(`Starting xAI URL processing pipeline`, {
    url,
    options: { enableLogging, enableTracing, maxRetries }
  });

  try {
    // Step 0: Validate if URL is an event link
    if (enableLogging) {
      logger.info('Validating event link', { url });
    }
    const validationResult = await validateEventLink({ url }, { enableLogging });
    
    if (!validationResult.is_event_link) {
      const executionTime = Date.now() - startTime;
      logger.info('URL is not an event link, skipping processing', {
        url,
        confidence: validationResult.confidence,
        reasoning: validationResult.reasoning
      });
      return {
        success: false,
        is_event_link: false,
        error: new Error(`URL is not an event link: ${validationResult.reasoning}`),
        executionTime
      };
    }

    if (enableLogging) {
      logger.info('Event link validated', {
        url,
        is_event_link: validationResult.is_event_link,
        confidence: validationResult.confidence,
        event_type_hint: validationResult.event_type_hint
      });
    }

    // Step 0.5: Classify event category
    if (enableLogging) {
      logger.info('Classifying event category', { url });
    }
    const categoryResult = await classifyEventCategory({ url }, { enableLogging });
    
    if (enableLogging) {
      logger.info('Event category classified', {
        url,
        category: categoryResult.category,
        confidence: categoryResult.confidence,
        subcategory: categoryResult.subcategory
      });
    }

    // Execute all operations within a transaction
    return await withTransaction(async (client) => {
      let cityId: number | undefined;
      let cityRegionId: number | undefined;
      let localityId: number | undefined;
      let venueId: number | undefined;
      let activityId: number | undefined;
      let activityVenueMapId: number | undefined;

      let createdNewCity = false;
      let createdNewCityRegion = false;
      let createdNewLocality = false;
      let createdNewVenue = false;
      let createdNewActivity = false;

      let specializedExtraction: any = undefined;

      // Step 0.6: Run specialized agent based on category (if available for xAI)
      const xaiCategoryConfig = getXaiEventCategoryConfig(categoryResult.category);
      if (hasXaiSpecializedAgent(categoryResult.category) && xaiCategoryConfig?.specializedAgent) {
        if (enableLogging) {
          logger.info(`Running xAI specialized agent for category: ${categoryResult.category}`, { url });
        }
        try {
          specializedExtraction = await xaiCategoryConfig.specializedAgent({ url }, { enableLogging });
          if (enableLogging) {
            logger.info(`Specialized extraction completed for ${categoryResult.category}`, {
              category: categoryResult.category,
              hasExtraction: !!specializedExtraction
            });
          }
        } catch (error) {
          logger.error(`Specialized extraction failed for ${categoryResult.category}, continuing with standard pipeline`, error instanceof Error ? error : new Error(String(error)));
          // Continue with standard pipeline even if specialized extraction fails
        }
      } else {
        if (enableLogging) {
          logger.info(`No xAI specialized agent available for category: ${categoryResult.category}, using standard pipeline`, { url });
        }
      }

      // Step 1: Extract and save city
      // #region debug log
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'xai/index.ts:93',message:'Starting city extraction',data:{url},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
      // #endregion
      const cityResult = await xaiCityAgent.execute({ url }, { enableLogging });
      // #region debug log
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'xai/index.ts:96',message:'City extraction result',data:{success:cityResult.success,hasData:!!cityResult.data,hasError:!!cityResult.error,dataKeys:cityResult.data?Object.keys(cityResult.data):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
      // #endregion
      if (!cityResult.success || !cityResult.data) {
        // #region debug log
        try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'xai/index.ts:99',message:'City extraction failed',data:{success:cityResult.success,hasData:!!cityResult.data,error:cityResult.error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
        // #endregion
        throw cityResult.error || new Error('City extraction failed');
      }

      // Find or create city in database
      const cityDbResult = await findOrCreate(
        cityResult.data,
        (city) => getCityByNameAndCountry(city.name, city.country, client),
        (city) => createCity({ name: city.name, country: city.country }, client),
        (city) => city.city_id,
        { enableLogging, client }
      );
      cityId = cityDbResult.id;
      createdNewCity = cityDbResult.created;

      // Step 2: Extract and save city region
      const cityRegionResult = await xaiCityRegionAgent.execute({
        url,
        city_id: cityId,
        city_name: cityResult.data.name
      }, { enableLogging });

      if (!cityRegionResult.success || !cityRegionResult.data) {
        throw cityRegionResult.error || new Error('City region extraction failed');
      }

      // Find or create city region with similarity matching
      const cityRegionDbResult = await findOrCreateWithSimilarity(
        { name: cityRegionResult.data.name, city_id: cityId },
        (cr) => Promise.resolve(null), // No direct lookup for city regions
        () => getCityRegionsByCityId(cityId!), // Note: client not supported, but still in transaction
        cityRegionSimilarityMatcher,
        (cr) => createCityRegion({ city_id: cr.city_id, name: cr.name }, client),
        (cr) => cr.city_region_id,
        { enableLogging, client }
      );
      cityRegionId = cityRegionDbResult.id;
      createdNewCityRegion = cityRegionDbResult.created;

      // Step 3: Extract and save locality
      const localityResult = await xaiLocalityAgent.execute({
        url,
        city_region_id: cityRegionId,
        city_region_name: cityRegionResult.data.name
      }, { enableLogging });

      if (!localityResult.success || !localityResult.data) {
        throw localityResult.error || new Error('Locality extraction failed');
      }

      // Find or create locality with similarity matching
      const localityDbResult = await findOrCreateWithSimilarity(
        localityResult.data,
        (loc) => Promise.resolve(null), // No direct lookup
        () => getLocalitiesByCityRegionId(cityRegionId!), // Note: client not supported, but still in transaction
        localitySimilarityMatcher,
        (loc) => createLocality({
          name: loc.name,
          pincode: loc.pincode,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          city_region_id: cityRegionId!
        }, client),
        (loc) => loc.locality_id,
        { enableLogging, client }
      );
      localityId = localityDbResult.id;
      createdNewLocality = localityDbResult.created;

      // Step 4: Extract and save venue
      const venueResult = await xaiVenueAgent.execute({
        url,
        locality_id: localityId,
        locality_name: localityResult.data.name
      }, { enableLogging });

      if (!venueResult.success || !venueResult.data) {
        throw venueResult.error || new Error('Venue extraction failed');
      }

      // Find or create venue with similarity matching
      // Create venue data with locality_id for similarity matching
      const venueDataForMatching: VenueRow & { locality_id: number } = {
        ...venueResult.data,
        locality_id: localityId!
      };
      const venueDbResult = await findOrCreateWithSimilarity(
        venueDataForMatching,
        (ven: VenueRow & { locality_id: number }) => Promise.resolve(null), // No direct lookup
        () => getVenuesByLocalityId(localityId!), // Note: client not supported, but still in transaction
        venueSimilarityMatcher,
        (ven: VenueRow & { locality_id: number }) => createVenue({
          name: ven.name,
          latitude: ven.latitude,
          longitude: ven.longitude,
          google_maps_location: ven.google_maps_location,
          directions_to_reach: ven.directions_to_reach,
          address: ven.address,
          is_public: ven.is_public,
          is_active: ven.is_active,
          is_verified: ven.is_verified,
          is_approved: ven.is_approved,
          price_point: ven.price_point,
          open_time: ven.open_time,
          close_time: ven.close_time,
          locality_id: localityId!,
          type: ven.type
        }, client),
        (ven) => ven.venue_id,
        { enableLogging, client }
      );
      venueId = venueDbResult.id;
      createdNewVenue = venueDbResult.created;

      // Step 5: Extract and save activity
      const activityResult = await xaiActivityAgent.execute({ url }, { enableLogging });

      if (!activityResult.success || !activityResult.data) {
        throw activityResult.error || new Error('Activity extraction failed');
      }

      // Find or create activity (simple search by name)
      const existingActivities = await searchActivitiesByName(activityResult.data.name);
      if (existingActivities.length > 0) {
        activityId = existingActivities[0].activity_id;
        createdNewActivity = false;
      } else {
        // Get max activity_id to create new one
        const allActivities = await getAllActivities();
        const maxActivityId = allActivities.length > 0 
          ? Math.max(...allActivities.map(a => a.activity_id)) 
          : 0;
        const newActivity = await createActivity({
          activity_id: maxActivityId + 1,
          name: activityResult.data.name,
          description: activityResult.data.description,
          quorum: activityResult.data.quorum
        });
        activityId = newActivity.activity_id;
        createdNewActivity = true;
      }

      // Step 6: Extract and save activity venue map
      const avmResult = await xaiActivityVenueMapAgent.execute({
        url,
        activity_id: activityId,
        activity_name: activityResult.data.name,
        venue_id: venueId,
        venue_name: venueResult.data.name
      }, { enableLogging });

      if (!avmResult.success || !avmResult.data) {
        throw avmResult.error || new Error('Activity venue map extraction failed');
      }

      // Create activity venue map entry
      const avmData = avmResult.data;
      const avmEntry = await createActivityVenueMap({
        activity_id: activityId!,
        venue_id: venueId!,
        start_time: new Date(avmData.start_time),
        end_time: new Date(avmData.end_time),
        is_active: avmData.is_active,
        is_public: avmData.is_public,
        max_people: avmData.max_people,
        parallel_slots: avmData.parallel_slots,
        is_hosted: avmData.is_hosted,
        date: new Date(avmData.date),
        is_ticketed: avmData.is_ticketed,
        ticket_price: avmData.ticket_price || undefined,
        description: avmData.description,
        img_url: avmData.img_url || undefined,
        booking_link: avmData.booking_link
      }, client);
      activityVenueMapId = avmEntry.id;

      const executionTime = Date.now() - startTime;

      // #region debug log
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'xai/index.ts:250',message:'All database operations completed',data:{executionTime,cityId,cityRegionId,localityId,venueId,activityId,activityVenueMapId,createdNewCity,createdNewCityRegion,createdNewLocality,createdNewVenue,createdNewActivity},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
      // #endregion

      logger.info(`xAI URL processing completed successfully`, {
        url,
        executionTime: `${executionTime}ms`,
        cityId,
        cityRegionId,
        localityId,
        venueId,
        activityId,
        activityVenueMapId
      });

      return {
        success: true,
        city_id: cityId,
        city_region_id: cityRegionId,
        locality_id: localityId,
        venue_id: venueId,
        activity_id: activityId,
        activity_venue_map_id: activityVenueMapId,
        created_new_city: createdNewCity,
        created_new_city_region: createdNewCityRegion,
        created_new_locality: createdNewLocality,
        created_new_venue: createdNewVenue,
        created_new_activity: createdNewActivity,
        is_event_link: validationResult.is_event_link,
        event_category: categoryResult.category,
        category_confidence: categoryResult.confidence,
        specialized_extraction: specializedExtraction,
        executionTime
      };
    });

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    // #region debug log
    try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'xai/index.ts:156',message:'Pipeline error caught',data:{errorName:error?.name,errorMessage:error?.message,errorStack:error?.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
    // #endregion
    const agentError = classifyError(error);

    logger.error(`xAI URL processing pipeline failed with exception`, agentError, {
      url,
      executionTime: `${executionTime}ms`
    });

    return {
      success: false,
      error: agentError,
      executionTime
    };
  }
}

/**
 * Run URL processing with database transaction wrapping
 * This ensures all database operations are atomic
 */
export async function runUrlProcessingPipelineWithTransaction(
  url: string,
  options: {
    enableLogging?: boolean;
    enableTracing?: boolean;
    maxRetries?: number;
  } = {}
): Promise<UrlProcessingResult> {
  return await logger.trace('URL Processing Pipeline with Transaction', async () => {
    // For now, just call the regular pipeline
    // In the future, we could wrap this in a transaction if needed
    return runUrlProcessingPipeline(url, options);
  });
}

// Export all xAI agents for direct usage
export {
  xaiCityAgent,
  xaiCityRegionAgent,
  xaiLocalityAgent,
  xaiVenueAgent,
  xaiActivityAgent,
  xaiActivityVenueMapAgent,
  xaiEventLinkValidatorAgent,
  xaiEventCategoryClassifierAgent,
  xaiMovieAgent,
  xaiGokartingAgent
};

// Export event validation and classification functions
export {
  validateEventLink,
  classifyEventCategory,
  extractMovieInformation,
  extractGokartingInformation
};

// Re-export common types and constants
export { EVENT_CATEGORIES } from '../utils/schemas';
export type { EventCategory, EventCategoryClassificationResult, EventLinkValidationResult, MovieExtractionResult, GokartingExtractionResult } from '../utils/schemas';

// Export similarity matchers (wrapped for dbOperations compatibility)
export {
  localitySimilarityMatcher,
  cityRegionSimilarityMatcher,
  venueSimilarityMatcher
};