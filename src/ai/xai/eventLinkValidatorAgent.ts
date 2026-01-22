/**
 * xAI Event Link Validator Agent
 * 
 * Validates if a given URL is an event link or not.
 * Uses common schemas and prompts from utils.
 */

import { BaseXaiAgent } from './baseAgent';
import { EventLinkValidationSchema, type EventLinkValidationResult } from '../utils/schemas';
import { getEventLinkValidationPrompt, getEventLinkValidationUserMessage } from '../utils/extractionPrompts';
import { logger } from '../utils/logging';

export interface EventLinkValidatorInput {
  url: string;
}

/**
 * Event link validator agent
 */
class EventLinkValidatorAgent extends BaseXaiAgent<EventLinkValidatorInput, EventLinkValidationResult> {
  getName(): string {
    return 'Event Link Validator Agent (xAI)';
  }

  getInstructions(): string {
    return getEventLinkValidationPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly.';
  }

  buildUserMessage(input: EventLinkValidatorInput): string {
    return getEventLinkValidationUserMessage(input.url);
  }
}

/**
 * Singleton xAI Event Link Validator Agent instance
 */
export const xaiEventLinkValidatorAgent = new EventLinkValidatorAgent(
  'Event Link Validator Agent (xAI)',
  EventLinkValidationSchema
);

/**
 * Validate if a URL is an event link
 */
export async function validateEventLink(
  input: EventLinkValidatorInput,
  options?: { enableLogging?: boolean }
): Promise<EventLinkValidationResult> {
  const { enableLogging = false } = options || {};

  try {
    if (enableLogging) {
      logger.info('Validating event link', {
        url: input.url
      });
    }

    const validationResult = await xaiEventLinkValidatorAgent.execute(input, {
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
