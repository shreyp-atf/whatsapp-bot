/**
 * Activity database operations
 */

import { query } from './connection';
import { Activity, CreateActivityInput } from '../types/database';

/**
 * Get activity by activity_id
 */
export async function getActivityById(activityId: number): Promise<Activity | null> {
  const result = await query('SELECT * FROM public.activity WHERE activity_id = $1', [activityId]);
  return result.rows[0] || null;
}

/**
 * Get all activities
 */
export async function getAllActivities(): Promise<Activity[]> {
  const result = await query('SELECT * FROM public.activity ORDER BY created_at DESC');
  return result.rows;
}

/**
 * Create a new activity
 */
export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const { activity_id, name, description, quorum } = input;
  const now = new Date();
  
  const result = await query(
    `INSERT INTO public.activity (activity_id, created_at, name, description, quorum)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [activity_id, now, name, description, quorum]
  );
  
  return result.rows[0];
}

/**
 * Update an activity
 */
export async function updateActivity(activityId: number, updates: Partial<Omit<CreateActivityInput, 'activity_id'>>): Promise<Activity> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.quorum !== undefined) {
    fields.push(`quorum = $${paramIndex++}`);
    values.push(updates.quorum);
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  values.push(activityId);
  
  const result = await query(
    `UPDATE public.activity SET ${fields.join(', ')} WHERE activity_id = $${paramIndex} RETURNING *`,
    values
  );
  
  if (!result.rows[0]) {
    throw new Error(`Activity with id ${activityId} not found`);
  }
  
  return result.rows[0];
}

/**
 * Delete an activity
 */
export async function deleteActivity(activityId: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM public.activity WHERE activity_id = $1 RETURNING activity_id',
    [activityId]
  );
  
  return result.rowCount > 0;
}

/**
 * Search activities by name (case-insensitive)
 */
export async function searchActivitiesByName(searchTerm: string): Promise<Activity[]> {
  const result = await query(
    'SELECT * FROM public.activity WHERE name ILIKE $1 ORDER BY name',
    [`%${searchTerm}%`]
  );
  
  return result.rows;
}

/**
 * Get activities with quorum greater than or equal to specified value
 */
export async function getActivitiesByMinQuorum(minQuorum: number): Promise<Activity[]> {
  const result = await query(
    'SELECT * FROM public.activity WHERE quorum >= $1 ORDER BY quorum ASC',
    [minQuorum]
  );
  
  return result.rows;
}

/**
 * Get activities count
 */
export async function getActivitiesCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.activity');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if activity exists
 */
export async function activityExists(activityId: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.activity WHERE activity_id = $1',
    [activityId]
  );
  
  return result.rowCount > 0;
}

