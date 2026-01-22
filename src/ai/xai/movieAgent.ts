/**
 * xAI Movie Agent
 * 
 * Specialized agent for extracting movie times and listings from theatre pages.
 * This agent is specifically designed to handle movie theatre websites and extract:
 * - Movie titles and showtimes
 * - Theatre information
 * - Pricing information
 * - Booking links
 * - Available dates and time slots
 */

import { BaseXaiAgent } from './baseAgent';
import { z } from 'zod';
import { logger } from '../utils/logging';

// Schema for movie extraction result
const MovieExtractionSchema = z.object({
  movie_title: z.string().min(1),
  theatre_name: z.string().min(1),
  showtimes: z.array(z.object({
    date: z.string().date(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // HH:MM format
    format: z.string().nullable().optional(), // e.g., "2D", "3D", "IMAX", "Dolby"
    language: z.string().nullable().optional(), // e.g., "English", "Hindi"
    screen_number: z.string().nullable().optional()
  })),
  pricing: z.object({
    base_price: z.number().nullable().optional(),
    currency: z.string().default('INR'),
    price_ranges: z.array(z.object({
      seat_type: z.string().nullable().optional(), // e.g., "Standard", "Premium", "VIP"
      price: z.number()
    })).optional()
  }),
  booking_link: z.string().min(1),
  available_dates: z.array(z.string().date()),
  venue_address: z.string().nullable().optional(),
  venue_location: z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional()
  }).optional(),
  research_notes: z.string().min(1)
});

export type MovieExtractionResult = z.infer<typeof MovieExtractionSchema>;

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
