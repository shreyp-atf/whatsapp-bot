/**
 * City database operations (read-only)
 */

import { query } from './connection';
import { City } from '../types/database';
import { PoolClient } from 'pg';

/**
 * Get city by city_id
 */
export async function getCityById(cityId: number): Promise<City | null> {
  const result = await query('SELECT * FROM public.city WHERE city_id = $1', [cityId]);
  return result.rows[0] || null;
}

/**
 * Get all cities
 */
export async function getAllCities(): Promise<City[]> {
  const result = await query('SELECT * FROM public.city ORDER BY name');
  return result.rows;
}

/**
 * Get cities by country
 */
export async function getCitiesByCountry(country: string): Promise<City[]> {
  const result = await query(
    'SELECT * FROM public.city WHERE country = $1 ORDER BY name',
    [country]
  );
  return result.rows;
}

/**
 * Search cities by name (case-insensitive)
 */
export async function searchCitiesByName(searchTerm: string): Promise<City[]> {
  const result = await query(
    'SELECT * FROM public.city WHERE name ILIKE $1 ORDER BY name',
    [`%${searchTerm}%`]
  );
  return result.rows;
}

/**
 * Get cities count
 */
export async function getCitiesCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.city');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if city exists
 */
export async function cityExists(cityId: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.city WHERE city_id = $1',
    [cityId]
  );
  return result.rowCount > 0;
}

/**
 * Get city by name and country
 */
export async function getCityByNameAndCountry(
  name: string, 
  country: string, 
  client?: PoolClient
): Promise<City | null> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn(
    'SELECT * FROM public.city WHERE name ILIKE $1 AND country = $2',
    [name, country]
  );
  return result.rows[0] || null;
}

/**
 * Create a new city
 */
export async function createCity(
  input: {
    country: string;
    name: string;
  },
  client?: PoolClient
): Promise<City> {
  const now = new Date();
  const queryFn = client ? client.query.bind(client) : query;

  const result = await queryFn(
    `INSERT INTO public.city (created_at, country, name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [now, input.country, input.name]
  );

  return result.rows[0];
}

