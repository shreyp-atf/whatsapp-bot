/**
 * City Region database operations (read-only)
 */

import { query } from './connection';
import { CityRegion } from '../types/database';
import { PoolClient } from 'pg';

/**
 * Get city region by city_region_id
 */
export async function getCityRegionById(cityRegionId: number): Promise<CityRegion | null> {
  const result = await query('SELECT * FROM public.city_region WHERE city_region_id = $1', [cityRegionId]);
  return result.rows[0] || null;
}

/**
 * Get all city regions
 */
export async function getAllCityRegions(): Promise<CityRegion[]> {
  const result = await query('SELECT * FROM public.city_region ORDER BY name');
  return result.rows;
}

/**
 * Get city regions by city_id
 */
export async function getCityRegionsByCityId(cityId: number): Promise<CityRegion[]> {
  const result = await query(
    'SELECT * FROM public.city_region WHERE city_id = $1 ORDER BY name',
    [cityId]
  );
  return result.rows;
}

/**
 * Search city regions by name (case-insensitive)
 */
export async function searchCityRegionsByName(searchTerm: string): Promise<CityRegion[]> {
  const result = await query(
    'SELECT * FROM public.city_region WHERE name ILIKE $1 ORDER BY name',
    [`%${searchTerm}%`]
  );
  return result.rows;
}

/**
 * Get city regions count
 */
export async function getCityRegionsCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.city_region');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if city region exists
 */
export async function cityRegionExists(cityRegionId: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.city_region WHERE city_region_id = $1',
    [cityRegionId]
  );
  return result.rowCount > 0;
}

/**
 * Create a new city region
 */
export async function createCityRegion(
  input: {
    city_id: number;
    name: string;
  },
  client?: PoolClient
): Promise<CityRegion> {
  const now = new Date();
  const queryFn = client ? client.query.bind(client) : query;

  const result = await queryFn(
    `INSERT INTO public.city_region (created_at, city_id, name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [now, input.city_id, input.name]
  );

  return result.rows[0];
}

