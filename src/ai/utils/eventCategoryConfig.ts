/**
 * Event Category Configuration
 * 
 * Centralized configuration for event categories and their associated specialized agents.
 * This makes it easy to add new event categories and their corresponding extraction agents.
 * This is provider-agnostic and can be used by both OpenAI and xAI implementations.
 */

import { EventCategory, EVENT_CATEGORIES } from './schemas';

/**
 * Configuration for each event category
 */
export interface EventCategoryConfig {
  category: EventCategory;
  name: string;
  description: string;
  hasSpecializedAgent: boolean;
  // Note: Specialized agent functions are provider-specific and should be registered separately
}

/**
 * Event category configurations
 * Add new categories here as they are implemented
 */
export const EVENT_CATEGORY_CONFIGS: Record<EventCategory, EventCategoryConfig> = {
  [EVENT_CATEGORIES.MOVIE]: {
    category: EVENT_CATEGORIES.MOVIE,
    name: 'Movie',
    description: 'Movie screenings, film showtimes, cinema listings',
    hasSpecializedAgent: true
  },
  [EVENT_CATEGORIES.GOKARTING]: {
    category: EVENT_CATEGORIES.GOKARTING,
    name: 'Go-Karting',
    description: 'Go-karting sessions, karting tracks, racing events',
    hasSpecializedAgent: true
  },
  [EVENT_CATEGORIES.CONCERT]: {
    category: EVENT_CATEGORIES.CONCERT,
    name: 'Concert',
    description: 'Music concerts, live performances, music events',
    hasSpecializedAgent: false
  },
  [EVENT_CATEGORIES.SPORTS]: {
    category: EVENT_CATEGORIES.SPORTS,
    name: 'Sports',
    description: 'Sports events, matches, tournaments',
    hasSpecializedAgent: false
  },
  [EVENT_CATEGORIES.THEATRE]: {
    category: EVENT_CATEGORIES.THEATRE,
    name: 'Theatre',
    description: 'Theatre shows, plays, stage performances',
    hasSpecializedAgent: false
  },
  [EVENT_CATEGORIES.WORKSHOP]: {
    category: EVENT_CATEGORIES.WORKSHOP,
    name: 'Workshop',
    description: 'Workshops, classes, educational events',
    hasSpecializedAgent: false
  },
  [EVENT_CATEGORIES.EXHIBITION]: {
    category: EVENT_CATEGORIES.EXHIBITION,
    name: 'Exhibition',
    description: 'Art exhibitions, galleries, displays',
    hasSpecializedAgent: false
  },
  [EVENT_CATEGORIES.FOOD_EVENT]: {
    category: EVENT_CATEGORIES.FOOD_EVENT,
    name: 'Food Event',
    description: 'Food festivals, culinary events, food-related activities',
    hasSpecializedAgent: false
  },
  [EVENT_CATEGORIES.OTHER]: {
    category: EVENT_CATEGORIES.OTHER,
    name: 'Other',
    description: 'Any other event type not covered above',
    hasSpecializedAgent: false
  }
};

/**
 * Get configuration for a specific event category
 */
export function getEventCategoryConfig(category: EventCategory): EventCategoryConfig {
  return EVENT_CATEGORY_CONFIGS[category];
}

/**
 * Get all categories that have specialized agents
 */
export function getCategoriesWithSpecializedAgents(): EventCategory[] {
  return Object.values(EVENT_CATEGORY_CONFIGS)
    .filter(config => config.hasSpecializedAgent)
    .map(config => config.category);
}

/**
 * Check if a category has a specialized agent
 */
export function hasSpecializedAgent(category: EventCategory): boolean {
  return EVENT_CATEGORY_CONFIGS[category].hasSpecializedAgent;
}
