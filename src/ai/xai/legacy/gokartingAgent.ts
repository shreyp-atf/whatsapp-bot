/**
 * xAI Gokarting Agent
 * 
 * Specialized agent for extracting timeslots, prices, and other information from gokarting venue listing pages.
 * Uses common schemas and prompts from utils.
 */

import { BaseXaiAgent } from './baseAgent';
import { GokartingExtractionSchema, type GokartingExtractionResult } from '../../utils/schemas';
import { getGokartingExtractionPrompt, getGokartingExtractionUserMessage } from '../../utils/extractionPrompts';
import { logger } from '../../utils/logging';

export interface GokartingAgentInput {
  url: string;
}

/**
 * Gokarting extraction agent
 */
class GokartingExtractionAgent extends BaseXaiAgent<GokartingAgentInput, GokartingExtractionResult> {
  getName(): string {
    return 'Gokarting Extraction Agent (xAI)';
  }

  getInstructions(): string {
    return getGokartingExtractionPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly to extract all gokarting-related information.';
  }

  buildUserMessage(input: GokartingAgentInput): string {
    return getGokartingExtractionUserMessage(input.url);
  }
}

/**
 * Singleton xAI Gokarting Agent instance
 */
export const xaiGokartingAgent = new GokartingExtractionAgent(
  'Gokarting Extraction Agent (xAI)',
  GokartingExtractionSchema
);

/**
 * Extract gokarting information from a venue page URL
 */
export async function extractGokartingInformation(
  input: GokartingAgentInput,
  options?: { enableLogging?: boolean }
): Promise<GokartingExtractionResult> {
  const { enableLogging = false } = options || {};

  try {
    if (enableLogging) {
      logger.info('Extracting gokarting information', {
        url: input.url
      });
    }

    const extractionResult = await xaiGokartingAgent.execute(input, {
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
