/**
 * Venue database operations (read-only)
 */

import { query } from './connection';
import { Venue } from '../types/database';
import { PoolClient } from 'pg';

/**
 * Get venue by venue_id
 */
export async function getVenueById(venueId: number): Promise<Venue | null> {
  const result = await query('SELECT * FROM public.venue WHERE venue_id = $1', [venueId]);
  return result.rows[0] || null;
}

/**
 * Get all venues
 */
export async function getAllVenues(): Promise<Venue[]> {
  const result = await query('SELECT * FROM public.venue ORDER BY name');
  return result.rows;
}

/**
 * Get venues by locality_id
 */
export async function getVenuesByLocalityId(localityId: number): Promise<Venue[]> {
  const result = await query(
    'SELECT * FROM public.venue WHERE locality_id = $1 ORDER BY name',
    [localityId]
  );
  return result.rows;
}

/**
 * Get active venues
 */
export async function getActiveVenues(): Promise<Venue[]> {
  const result = await query(
    'SELECT * FROM public.venue WHERE is_active = true ORDER BY name'
  );
  return result.rows;
}

/**
 * Get public venues
 */
export async function getPublicVenues(): Promise<Venue[]> {
  const result = await query(
    'SELECT * FROM public.venue WHERE is_public = true ORDER BY name'
  );
  return result.rows;
}

/**
 * Get verified venues
 */
export async function getVerifiedVenues(): Promise<Venue[]> {
  const result = await query(
    'SELECT * FROM public.venue WHERE is_verified = true ORDER BY name'
  );
  return result.rows;
}

/**
 * Get approved venues
 */
export async function getApprovedVenues(): Promise<Venue[]> {
  const result = await query(
    'SELECT * FROM public.venue WHERE is_approved = true ORDER BY name'
  );
  return result.rows;
}

/**
 * Get venues by price point
 */
export async function getVenuesByPricePoint(pricePoint: number): Promise<Venue[]> {
  const result = await query(
    'SELECT * FROM public.venue WHERE price_point = $1 ORDER BY name',
    [pricePoint]
  );
  return result.rows;
}

/**
 * Search venues by name (case-insensitive)
 */
export async function searchVenuesByName(searchTerm: string): Promise<Venue[]> {
  const result = await query(
    'SELECT * FROM public.venue WHERE name ILIKE $1 ORDER BY name',
    [`%${searchTerm}%`]
  );
  return result.rows;
}

/**
 * Get venues within a geographic radius
 * Note: This uses a simple bounding box approximation. For precise distance calculations,
 * consider using PostGIS extension with ST_DWithin or similar functions.
 */
export async function getVenuesNearCoordinates(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Venue[]> {
  // Simple bounding box approximation (1 degree ≈ 111 km)
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));
  
  const result = await query(
    `SELECT * FROM public.venue 
     WHERE latitude BETWEEN $1 AND $2 
     AND longitude BETWEEN $3 AND $4 
     ORDER BY name`,
    [latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta]
  );
  return result.rows;
}

/**
 * Get venues count
 */
export async function getVenuesCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.venue');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if venue exists
 */
export async function venueExists(venueId: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.venue WHERE venue_id = $1',
    [venueId]
  );
  return result.rowCount > 0;
}

/**
 * Create a new venue
 */
export async function createVenue(
  input: {
    name: string;
    latitude: number;
    longitude: number;
    google_maps_location: string;
    directions_to_reach: string | null;
    address: string;
    is_public?: boolean;
    is_active?: boolean;
    is_verified?: boolean;
    is_approved?: boolean;
    price_point: number | null;
    open_time: string;
    close_time: string;
    locality_id: number;
    type: string;
    booking_link?: string | null;
    notes?: string | null;
  },
  client?: PoolClient
): Promise<Venue> {
  const now = new Date();
  const queryFn = client ? client.query.bind(client) : query;

  const result = await queryFn(
    `INSERT INTO public.venue (
      created_at, name, latitude, longitude, google_maps_location, directions_to_reach,
      address, is_public, is_active, is_verified, is_approved, price_point,
      open_time, close_time, updated_at, locality_id, type, booking_link, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING *`,
    [
      now,
      input.name,
      input.latitude,
      input.longitude,
      input.google_maps_location,
      input.directions_to_reach,
      input.address,
      input.is_public ?? false,
      input.is_active ?? false,
      input.is_verified ?? false,
      input.is_approved ?? false,
      input.price_point,
      input.open_time,
      input.close_time,
      now,
      input.locality_id,
      input.type,
      input.booking_link ?? null,
      input.notes ?? null
    ]
  );

  return result.rows[0];
}

