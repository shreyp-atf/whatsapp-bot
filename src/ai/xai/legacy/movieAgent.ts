/**
 * xAI Movie Agent
 * 
 * Specialized agent for extracting movie times and listings from theatre pages.
 * Uses common schemas and prompts from utils.
 */

import { BaseXaiAgent } from './baseAgent';
import { MovieExtractionSchema, type MovieExtractionResult } from '../../utils/schemas';
import { getMovieExtractionPrompt, getMovieExtractionUserMessage } from '../../utils/extractionPrompts';
import { logger } from '../../utils/logging';

export interface MovieAgentInput {
  url: string;
}

/**
 * Movie extraction agent
 */
class MovieExtractionAgent extends BaseXaiAgent<MovieAgentInput, MovieExtractionResult> {
  getName(): string {
    return 'Movie Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getMovieExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly to extract all movie-related information.';
  }

  buildUserMessage(input: MovieAgentInput): string {
    return getMovieExtractionUserMessage(input.url);
  }
}

/**
 * Singleton xAI Movie Agent instance
 */
export const xaiMovieAgent = new MovieExtractionAgent(
  'Movie Extraction Agent (xAI)',
  MovieExtractionSchema
);

/**
 * Extract movie information from a theatre page URL
 */
export async function extractMovieInformation(
  input: MovieAgentInput,
  options?: { enableLogging?: boolean }
): Promise<MovieExtractionResult> {
  const { enableLogging = false } = options || {};

  try {
    if (enableLogging) {
      logger.info('Extracting movie information', {
        url: input.url
      });
    }

    const extractionResult = await xaiMovieAgent.execute(input, {
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
