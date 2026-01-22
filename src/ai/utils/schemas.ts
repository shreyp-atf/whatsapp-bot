/**
 * Shared Zod Schemas
 * 
 * This module contains all Zod schemas used by both OpenAI and xAI agents.
 * Centralizing schemas ensures consistency and makes maintenance easier.
 */

import { z } from "zod";

// Schema for city row generation
export const CityRowSchema = z.object({
  name: z.string().min(1),
  country: z.string().min(1),
  research_notes: z.string().min(1).optional()
});

// Schema for city region row generation
export const CityRegionRowSchema = z.object({
  name: z.string().min(1),
  city_name: z.string().min(1),
  research_notes: z.string().min(1)
});

// Schema for locality row generation
export const LocalityRowSchema = z.object({
  name: z.string().min(1),
  pincode: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  city_name: z.string().min(1),
  city_region_name: z.string().min(1),
  research_notes: z.string().min(1)
});

// Schema for venue row generation
export const VenueRowSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  google_maps_location: z.string().min(1),
  directions_to_reach: z.string().nullable(),
  address: z.string().min(1),
  is_public: z.boolean().default(false),
  is_active: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  is_approved: z.boolean().default(false),
  price_point: z.number().min(1).max(5).nullable(),
  open_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  type: z.string().min(1),
  research_notes: z.string().min(1)
});

// Schema for activity row generation
export const ActivityRowSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  quorum: z.number().min(1),
  research_notes: z.string().min(1).optional()
});

// Schema for activity venue map row generation
export const ActivityVenueMapRowSchema = z.object({
  activity_id: z.number(),
  venue_id: z.number(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  is_active: z.boolean().default(true),
  is_public: z.boolean().default(true),
  max_people: z.number().min(1),
  parallel_slots: z.number().min(1).default(1),
  is_hosted: z.boolean().default(false),
  date: z.string().date(),
  is_ticketed: z.boolean(),
  ticket_price: z.number().nullable().optional(),
  description: z.string().min(1),
  img_url: z.string().nullable().optional(),
  booking_link: z.string().min(1),
  research_notes: z.string().min(1).optional()
});

// Main output schema combining venue, locality, and city region data
export const VenueLocalityAgentSchema = z.object({
  venue_row: VenueRowSchema,
  locality_row: LocalityRowSchema,
  city_region_row: CityRegionRowSchema
});

// Schema for locality similarity matching
export const LocalitySimilaritySchema = z.object({
  closest_match_id: z.number().nullable(),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  should_create_new: z.boolean()
});

// Schema for city region similarity matching
export const CityRegionSimilaritySchema = z.object({
  closest_match_id: z.number().nullable(),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  should_create_new: z.boolean()
});

// Schema for venue similarity matching
export const VenueSimilaritySchema = z.object({
  closest_match_id: z.number().nullable(),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  should_create_new: z.boolean()
});

// Event categories configuration
export const EVENT_CATEGORIES = {
  MOVIE: 'movie',
  GOKARTING: 'gokarting',
  CONCERT: 'concert',
  SPORTS: 'sports',
  THEATRE: 'theatre',
  WORKSHOP: 'workshop',
  EXHIBITION: 'exhibition',
  FOOD_EVENT: 'food_event',
  OTHER: 'other'
} as const;

export type EventCategory = typeof EVENT_CATEGORIES[keyof typeof EVENT_CATEGORIES];

// Schema for event link validation result
export const EventLinkValidationSchema = z.object({
  is_event_link: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  event_type_hint: z.string().nullable().optional() // e.g., "movie", "concert", "sports", etc.
});

// Schema for event category classification result
export const EventCategoryClassificationSchema = z.object({
  category: z.enum([
    EVENT_CATEGORIES.MOVIE,
    EVENT_CATEGORIES.GOKARTING,
    EVENT_CATEGORIES.CONCERT,
    EVENT_CATEGORIES.SPORTS,
    EVENT_CATEGORIES.THEATRE,
    EVENT_CATEGORIES.WORKSHOP,
    EVENT_CATEGORIES.EXHIBITION,
    EVENT_CATEGORIES.FOOD_EVENT,
    EVENT_CATEGORIES.OTHER
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  subcategory: z.string().nullable().optional() // e.g., "action", "comedy" for movies
});

// Schema for movie extraction result
export const MovieExtractionSchema = z.object({
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

// Schema for gokarting extraction result
export const GokartingExtractionSchema = z.object({
  venue_name: z.string().min(1),
  track_name: z.string().nullable().optional(),
  timeslots: z.array(z.object({
    date: z.string().date(),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // HH:MM format
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // HH:MM format
    duration_minutes: z.number().nullable().optional(),
    available: z.boolean().default(true),
    capacity: z.number().nullable().optional() // Number of karts available
  })),
  pricing: z.object({
    base_price: z.number().nullable().optional(),
    currency: z.string().default('INR'),
    price_options: z.array(z.object({
      session_type: z.string().nullable().optional(), // e.g., "Single Race", "Double Race", "Unlimited"
      duration_minutes: z.number().nullable().optional(),
      price: z.number(),
      description: z.string().nullable().optional()
    })).optional(),
    group_discounts: z.array(z.object({
      min_people: z.number(),
      discount_percentage: z.number().nullable().optional(),
      discount_amount: z.number().nullable().optional()
    })).optional()
  }),
  booking_link: z.string().min(1),
  available_dates: z.array(z.string().date()),
  restrictions: z.object({
    min_age: z.number().nullable().optional(),
    max_age: z.number().nullable().optional(),
    min_height_cm: z.number().nullable().optional(),
    max_height_cm: z.number().nullable().optional(),
    min_weight_kg: z.number().nullable().optional(),
    max_weight_kg: z.number().nullable().optional()
  }).optional(),
  track_info: z.object({
    track_length_km: z.number().nullable().optional(),
    track_type: z.string().nullable().optional(), // e.g., "Indoor", "Outdoor", "Mixed"
    kart_types: z.array(z.string()).optional() // e.g., ["Electric", "Gas"]
  }).optional(),
  venue_address: z.string().nullable().optional(),
  venue_location: z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional()
  }).optional(),
  operating_hours: z.object({
    open_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    close_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional()
  }).optional(),
  research_notes: z.string().min(1)
});

// Type exports for convenience
export type CityRow = z.infer<typeof CityRowSchema>;
export type CityRegionRow = z.infer<typeof CityRegionRowSchema>;
export type LocalityRow = z.infer<typeof LocalityRowSchema>;
export type VenueRow = z.infer<typeof VenueRowSchema>;
export type ActivityRow = z.infer<typeof ActivityRowSchema>;
export type ActivityVenueMapRow = z.infer<typeof ActivityVenueMapRowSchema>;
export type VenueLocalityAgentOutput = z.infer<typeof VenueLocalityAgentSchema>;
export type LocalitySimilarityResult = z.infer<typeof LocalitySimilaritySchema>;
export type CityRegionSimilarityResult = z.infer<typeof CityRegionSimilaritySchema>;
export type VenueSimilarityResult = z.infer<typeof VenueSimilaritySchema>;
export type EventLinkValidationResult = z.infer<typeof EventLinkValidationSchema>;
export type EventCategoryClassificationResult = z.infer<typeof EventCategoryClassificationSchema>;
export type MovieExtractionResult = z.infer<typeof MovieExtractionSchema>;
export type GokartingExtractionResult = z.infer<typeof GokartingExtractionSchema>;
