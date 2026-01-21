/**
 * Locality database operations (read-only)
 */

import { query } from './connection';
import { Locality } from '../types/database';
import { PoolClient } from 'pg';

/**
 * Get locality by locality_id
 */
export async function getLocalityById(localityId: number): Promise<Locality | null> {
  const result = await query('SELECT * FROM public.locality WHERE locality_id = $1', [localityId]);
  return result.rows[0] || null;
}

/**
 * Get all localities
 */
export async function getAllLocalities(): Promise<Locality[]> {
  const result = await query('SELECT * FROM public.locality ORDER BY name');
  return result.rows;
}

/**
 * Get localities by city_region_id
 */
export async function getLocalitiesByCityRegionId(cityRegionId: number): Promise<Locality[]> {
  const result = await query(
    'SELECT * FROM public.locality WHERE city_region_id = $1 ORDER BY name',
    [cityRegionId]
  );
  return result.rows;
}

/**
 * Get localities by pincode
 */
export async function getLocalitiesByPincode(pincode: string): Promise<Locality[]> {
  const result = await query(
    'SELECT * FROM public.locality WHERE pincode = $1 ORDER BY name',
    [pincode]
  );
  return result.rows;
}

/**
 * Search localities by name (case-insensitive)
 */
export async function searchLocalitiesByName(searchTerm: string): Promise<Locality[]> {
  const result = await query(
    'SELECT * FROM public.locality WHERE name ILIKE $1 ORDER BY name',
    [`%${searchTerm}%`]
  );
  return result.rows;
}

/**
 * Get localities within a geographic radius
 * Note: This uses a simple bounding box approximation. For precise distance calculations,
 * consider using PostGIS extension with ST_DWithin or similar functions.
 */
export async function getLocalitiesNearCoordinates(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Locality[]> {
  // Simple bounding box approximation (1 degree ≈ 111 km)
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));
  
  const result = await query(
    `SELECT * FROM public.locality 
     WHERE latitude BETWEEN $1 AND $2 
     AND longitude BETWEEN $3 AND $4 
     ORDER BY name`,
    [latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta]
  );
  return result.rows;
}

/**
 * Get localities count
 */
export async function getLocalitiesCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.locality');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if locality exists
 */
export async function localityExists(localityId: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.locality WHERE locality_id = $1',
    [localityId]
  );
  return result.rowCount > 0;
}

/**
 * Create a new locality
 */
export async function createLocality(
  input: {
    name: string;
    pincode: string;
    address: string;
    latitude: number;
    longitude: number;
    city_region_id: number;
  },
  client?: PoolClient
): Promise<Locality> {
  const now = new Date();
  const queryFn = client ? client.query.bind(client) : query;

  const result = await queryFn(
    `INSERT INTO public.locality (created_at, name, pincode, address, latitude, longitude, city_region_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [now, input.name, input.pincode, input.address, input.latitude, input.longitude, input.city_region_id]
  );

  return result.rows[0];
}

