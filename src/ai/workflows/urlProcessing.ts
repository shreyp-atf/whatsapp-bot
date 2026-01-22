/**
 * SDK-Agnostic URL Processing Workflow
 * 
 * Core workflow logic for processing URLs through the event extraction pipeline.
 * This workflow is provider-agnostic and routes to provider-specific executors.
 */

import { logger } from '../utils/logging';
import { classifyError } from '../utils/errorHandling';
import { findOrCreateWithSimilarity, findOrCreate } from '../utils/dbOperations';
import { withTransaction } from '../../db/connection';
import type { PoolClient } from 'pg';
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
import type { Provider } from '../utils/providerSelection';
import type { EventCategory } from '../utils/schemas';
import type { Locality, CityRegion, Venue } from '../../types/database';
import type { LocalityRow, VenueRow } from '../utils/schemas';
import { SimilarityMatcher } from '../utils/dbOperations';
import {
  findClosestLocalityMatch,
  findClosestCityRegionMatch,
  findClosestVenueMatch
} from '../utils/similarity';

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
  is_event_link?: boolean;
  event_category?: EventCategory;
  category_confidence?: number;
  specialized_extraction?: any;
}

/**
 * Get provider-specific agent executor
 */
async function getAgentExecutor(provider: Provider) {
  if (provider === 'xai') {
    const { executeAgent } = await import('../xai/agentExecutor');
    return executeAgent;
  } else {
    const { executeAgent } = await import('../openai/agentExecutor');
    return executeAgent;
  }
}

/**
 * Get provider-specific helper functions
 */
async function getProviderHelpers(provider: Provider) {
  if (provider === 'xai') {
    const helpers = await import('../xai/helpers');
    return {
      validateEventLink: helpers.validateEventLink,
      classifyEventCategory: helpers.classifyEventCategory,
      extractMovieInformation: helpers.extractMovieInformation,
      extractGokartingInformation: helpers.extractGokartingInformation
    };
  } else {
    const helpers = await import('../openai/helpers');
    return {
      validateEventLink: helpers.validateEventLink,
      classifyEventCategory: helpers.classifyEventCategory,
      extractMovieInformation: helpers.extractMovieInformation,
      extractGokartingInformation: helpers.extractGokartingInformation
    };
  }
}

/**
 * Get specialized extraction function for a category
 */
async function getSpecializedExtraction(
  category: EventCategory,
  provider: Provider
): Promise<((input: { url: string }, options?: { enableLogging?: boolean }) => Promise<any>) | null> {
  const helpers = await getProviderHelpers(provider);
  
  if (category === 'movie') {
    return helpers.extractMovieInformation;
  } else if (category === 'gokarting') {
    return helpers.extractGokartingInformation;
  }
  
  return null;
}

/**
 * Run the complete URL processing pipeline
 */
export async function runUrlProcessingPipeline(
  url: string,
  provider: Provider,
  options: {
    enableLogging?: boolean;
    enableTracing?: boolean;
    maxRetries?: number;
  } = {}
): Promise<UrlProcessingResult> {
  const startTime = Date.now();
  const { enableLogging = true, enableTracing = true, maxRetries = 2 } = options;

  logger.info(`Starting URL processing pipeline`, {
    url,
    provider,
    options: { enableLogging, enableTracing, maxRetries }
  });

  try {
    const executeAgent = await getAgentExecutor(provider);
    const helpers = await getProviderHelpers(provider);

    // Step 0: Validate if URL is an event link
    if (enableLogging) {
      logger.info('Validating event link', { url, provider });
    }
    const validationResult = await helpers.validateEventLink({ url }, { enableLogging });
    
    if (!validationResult.is_event_link) {
      const executionTime = Date.now() - startTime;
      logger.info('URL is not an event link, skipping processing', {
        url,
        provider,
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
        provider,
        is_event_link: validationResult.is_event_link,
        confidence: validationResult.confidence
      });
    }

    // Step 0.5: Classify event category
    if (enableLogging) {
      logger.info('Classifying event category', { url, provider });
    }
    const categoryResult = await helpers.classifyEventCategory({ url }, { enableLogging });
    
    if (enableLogging) {
      logger.info('Event category classified', {
        url,
        provider,
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

      // Step 0.6: Run specialized agent based on category (if available)
      const specializedExtractionFn = await getSpecializedExtraction(categoryResult.category, provider);
      if (specializedExtractionFn) {
        if (enableLogging) {
          logger.info(`Running specialized agent for category: ${categoryResult.category}`, { url, provider });
        }
        try {
          specializedExtraction = await specializedExtractionFn({ url }, { enableLogging });
          if (enableLogging) {
            logger.info(`Specialized extraction completed for ${categoryResult.category}`, {
              category: categoryResult.category,
              provider,
              hasExtraction: !!specializedExtraction
            });
          }
        } catch (error) {
          logger.error(`Specialized extraction failed for ${categoryResult.category}, continuing with standard pipeline`, error instanceof Error ? error : new Error(String(error)));
          // Continue with standard pipeline even if specialized extraction fails
        }
      } else {
        if (enableLogging) {
          logger.info(`No specialized agent available for category: ${categoryResult.category}, using standard pipeline`, { url, provider });
        }
      }

      // Create similarity matchers for this provider
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
            provider,
            { enableLogging: options?.enableLogging || false }
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
            provider,
            { enableLogging: options?.enableLogging || false }
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
            provider,
            { enableLogging: options?.enableLogging || false }
          );
          return result;
        }
      };

      // Step 1: Extract and save city
      const cityResult = await executeAgent('city', { url }, { enableLogging });
      if (!cityResult.success || !cityResult.data) {
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
      const cityRegionResult = await executeAgent('city-region', {
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
        (cr) => Promise.resolve(null),
        (client?: PoolClient) => getAllCityRegions(client),
        cityRegionSimilarityMatcher,
        (cr) => createCityRegion({ city_id: cr.city_id, name: cr.name }, client),
        (cr) => cr.city_region_id,
        { enableLogging, client }
      );
      cityRegionId = cityRegionDbResult.id;
      createdNewCityRegion = cityRegionDbResult.created;

      // Step 3: Extract and save locality
      const localityResult = await executeAgent('locality', {
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
        (loc) => Promise.resolve(null),
        (client?: PoolClient) => getAllLocalities(client),
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
      const venueResult = await executeAgent('venue', {
        url,
        locality_id: localityId,
        locality_name: localityResult.data.name
      }, { enableLogging });

      if (!venueResult.success || !venueResult.data) {
        throw venueResult.error || new Error('Venue extraction failed');
      }

      // Find or create venue with similarity matching
      const venueDataForMatching: VenueRow & { locality_id: number } = {
        ...venueResult.data,
        locality_id: localityId!
      };
      const venueDbResult = await findOrCreateWithSimilarity(
        venueDataForMatching,
        (ven: VenueRow & { locality_id: number }) => Promise.resolve(null),
        (client?: PoolClient) => getAllVenues(client),
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
      const activityResult = await executeAgent('activity', { url }, { enableLogging });

      if (!activityResult.success || !activityResult.data) {
        throw activityResult.error || new Error('Activity extraction failed');
      }

      // Find or create activity (simple search by name)
      const existingActivities = await searchActivitiesByName(activityResult.data.name);
      if (existingActivities.length > 0) {
        activityId = existingActivities[0].activity_id;
        createdNewActivity = false;
      } else {
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
      const avmResult = await executeAgent('activity-venue-map', {
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

      logger.info(`URL processing completed successfully`, {
        url,
        provider,
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
    const agentError = classifyError(error);

    logger.error(`URL processing pipeline failed`, agentError, {
      url,
      provider,
      executionTime: `${executionTime}ms`
    });

    return {
      success: false,
      error: agentError.originalError || agentError,
      executionTime
    };
  }
}
