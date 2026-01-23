/**
 * xAI Event Category Classifier Agent
 * 
 * Classifies the category/type of an event from a given event link.
 * Uses common schemas and prompts from utils.
 */

import { BaseXaiAgent } from './baseAgent';
import { 
  EventCategoryClassificationSchema, 
  type EventCategoryClassificationResult,
  EVENT_CATEGORIES,
  type EventCategory
} from '../../utils/schemas';
import { getEventCategoryClassificationPrompt, getEventCategoryClassificationUserMessage } from '../../utils/extractionPrompts';
import { logger } from '../../utils/logging';

// Re-export for convenience
export { EVENT_CATEGORIES, type EventCategory };

export interface EventCategoryClassifierInput {
  url: string;
  available_categories?: EventCategory[]; // Optional: restrict to specific categories
}

/**
 * Event category classifier agent
 */
class EventCategoryClassifierAgent extends BaseXaiAgent<EventCategoryClassifierInput, EventCategoryClassificationResult> {
  getName(): string {
    return 'Event Category Classifier Agent (xAI)';
  }

  getInstructions(): string {
    return getEventCategoryClassificationPrompt() + '\n\nYou have access to web search capabilities. Use web search to access and analyze the URL thoroughly to determine the most appropriate category.';
  }

  buildUserMessage(input: EventCategoryClassifierInput): string {
    return getEventCategoryClassificationUserMessage(input.url, input.available_categories);
  }
}

/**
 * Singleton xAI Event Category Classifier Agent instance
 */
export const xaiEventCategoryClassifierAgent = new EventCategoryClassifierAgent(
  'Event Category Classifier Agent (xAI)',
  EventCategoryClassificationSchema
);

/**
 * Classify the category of an event from a URL
 */
export async function classifyEventCategory(
  input: EventCategoryClassifierInput,
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

    const classificationResult = await xaiEventCategoryClassifierAgent.execute(input, {
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
