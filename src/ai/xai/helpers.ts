/**
 * xAI Helper Functions
 * 
 * Helper functions that combine agent execution with additional logic (logging, error handling, etc.)
 * These use the unified agent executor.
 */

import { logger } from '../utils/logging';
import { executeAgent } from './agentExecutor';
import type { EventLinkValidationResult } from '../utils/schemas';
import type { EventCategoryClassificationResult } from '../utils/schemas';
import type { MovieExtractionResult } from '../utils/schemas';
import type { GokartingExtractionResult } from '../utils/schemas';
import type { EventCategory } from '../utils/schemas';

/**
 * Validate if a URL is an event link
 */
export async function validateEventLink(
  input: { url: string },
  options?: { enableLogging?: boolean }
): Promise<EventLinkValidationResult> {
  const { enableLogging = false } = options || {};

  try {
    if (enableLogging) {
      logger.info('Validating event link', {
        url: input.url
      });
    }

    const validationResult = await executeAgent('event-link-validator', input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!validationResult.success || !validationResult.data) {
      throw validationResult.error || new Error('Event link validation failed');
    }

    const result = validationResult.data;

    if (enableLogging) {
      logger.info('Event link validation completed', {
        url: input.url,
        is_event_link: result.is_event_link,
        confidence: result.confidence,
        event_type_hint: result.event_type_hint
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to validate event link', error instanceof Error ? error : new Error(String(error)), {
      url: input.url
    });
    throw error;
  }
}

/**
 * Classify the category of an event from a URL
 */
export async function classifyEventCategory(
  input: { url: string; available_categories?: EventCategory[] },
  options?: { enableLogging?: boolean }
): Promise<EventCategoryClassificationResult> {
  const { enableLogging = false } = options || {};

  try {
    if (enableLogging) {
      logger.info('Classifying event category', {
        url: input.url,
        available_categories: input.available_categories
      });
    }

    const classificationResult = await executeAgent('event-category-classifier', input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!classificationResult.success || !classificationResult.data) {
      throw classificationResult.error || new Error('Event category classification failed');
    }

    const result = classificationResult.data;

    if (enableLogging) {
      logger.info('Event category classification completed', {
        url: input.url,
        category: result.category,
        confidence: result.confidence,
        subcategory: result.subcategory
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to classify event category', error instanceof Error ? error : new Error(String(error)), {
      url: input.url
    });
    throw error;
  }
}

/**
 * Extract movie information from a theatre page URL
 */
export async function extractMovieInformation(
  input: { url: string },
  options?: { enableLogging?: boolean }
): Promise<MovieExtractionResult> {
  const { enableLogging = false } = options || {};

  try {
    if (enableLogging) {
      logger.info('Extracting movie information', {
        url: input.url
      });
    }

    const extractionResult = await executeAgent('movie', input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('Movie extraction failed');
    }

    const result = extractionResult.data;

    if (enableLogging) {
      logger.info('Movie extraction completed', {
        url: input.url,
        movie_title: result.movie_title,
        theatre_name: result.theatre_name,
        showtimes_count: result.showtimes.length,
        available_dates_count: result.available_dates.length
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to extract movie information', error instanceof Error ? error : new Error(String(error)), {
      url: input.url
    });
    throw error;
  }
}

/**
 * Extract gokarting information from a venue page URL
 */
export async function extractGokartingInformation(
  input: { url: string },
  options?: { enableLogging?: boolean }
): Promise<GokartingExtractionResult> {
  const { enableLogging = false } = options || {};

  try {
    if (enableLogging) {
      logger.info('Extracting gokarting information', {
        url: input.url
      });
    }

    const extractionResult = await executeAgent('gokarting', input, {
      enableLogging,
      metadata: { provider: 'xai' }
    });

    if (!extractionResult.success || !extractionResult.data) {
      throw extractionResult.error || new Error('Gokarting extraction failed');
    }

    const result = extractionResult.data;

    if (enableLogging) {
      logger.info('Gokarting extraction completed', {
        url: input.url,
        venue_name: result.venue_name,
        timeslots_count: result.timeslots.length,
        available_dates_count: result.available_dates.length
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to extract gokarting information', error instanceof Error ? error : new Error(String(error)), {
      url: input.url
    });
    throw error;
  }
}
