/**
 * xAI-specific Event Category Configuration
 * 
 * This file extends the common event category config with xAI-specific specialized agent implementations.
 * The common config is in src/ai/utils/eventCategoryConfig.ts
 */

import { EventCategory, EVENT_CATEGORIES } from '../utils/schemas';
import { extractMovieInformation } from './helpers';
import { extractGokartingInformation } from './helpers';

/**
 * xAI-specific configuration for event categories with specialized agents
 */
export interface XaiEventCategoryConfig {
  category: EventCategory;
  hasSpecializedAgent: boolean;
  specializedAgent?: (input: { url: string }, options?: { enableLogging?: boolean }) => Promise<any>;
}

/**
 * xAI-specific event category configurations with specialized agents
 * Add new specialized agents here as they are implemented
 */
export const XAI_EVENT_CATEGORY_CONFIGS: Partial<Record<EventCategory, XaiEventCategoryConfig>> = {
  [EVENT_CATEGORIES.MOVIE]: {
    category: EVENT_CATEGORIES.MOVIE,
    hasSpecializedAgent: true,
    specializedAgent: extractMovieInformation
  },
  [EVENT_CATEGORIES.GOKARTING]: {
    category: EVENT_CATEGORIES.GOKARTING,
    hasSpecializedAgent: true,
    specializedAgent: extractGokartingInformation
  }
};

/**
 * Get xAI-specific configuration for a specific event category
 */
export function getXaiEventCategoryConfig(category: EventCategory): XaiEventCategoryConfig | undefined {
  return XAI_EVENT_CATEGORY_CONFIGS[category];
}

/**
 * Check if a category has an xAI specialized agent
 */
export function hasXaiSpecializedAgent(category: EventCategory): boolean {
  return XAI_EVENT_CATEGORY_CONFIGS[category]?.hasSpecializedAgent === true;
}
