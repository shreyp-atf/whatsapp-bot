/**
 * Plan database operations
 */

import { query } from './connection';
import { Plan, CreatePlanInput, UpdatePlanInput } from '../types/database';

/**
 * Get plan by id
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  const result = await query('SELECT * FROM public.plan WHERE id = $1', [planId]);
  return result.rows[0] || null;
}

/**
 * Get all plans
 */
export async function getAllPlans(): Promise<Plan[]> {
  const result = await query('SELECT * FROM public.plan ORDER BY start_time DESC');
  return result.rows;
}

/**
 * Create a new plan
 */
export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const { start_time, prompted_by, status, is_public } = input;
  const startTime = start_time instanceof Date ? start_time : new Date(start_time);
  
  const result = await query(
    `INSERT INTO public.plan (start_time, prompted_by, status, is_public)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [startTime, prompted_by, status, is_public]
  );
  
  return result.rows[0];
}

/**
 * Update a plan
 */
export async function updatePlan(planId: string, updates: UpdatePlanInput): Promise<Plan> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.start_time !== undefined) {
    const startTime = updates.start_time instanceof Date ? updates.start_time : new Date(updates.start_time);
    fields.push(`start_time = $${paramIndex++}`);
    values.push(startTime);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.is_public !== undefined) {
    fields.push(`is_public = $${paramIndex++}`);
    values.push(updates.is_public);
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  values.push(planId);
  
  const result = await query(
    `UPDATE public.plan SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  if (!result.rows[0]) {
    throw new Error(`Plan with id ${planId} not found`);
  }
  
  return result.rows[0];
}

/**
 * Delete a plan
 */
export async function deletePlan(planId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM public.plan WHERE id = $1 RETURNING id',
    [planId]
  );
  
  return result.rowCount > 0;
}

/**
 * Get plans by prompted_by (user who created the plan)
 */
export async function getPlansByPromptedBy(userId: number): Promise<Plan[]> {
  const result = await query(
    'SELECT * FROM public.plan WHERE prompted_by = $1 ORDER BY start_time DESC',
    [userId]
  );
  return result.rows;
}

/**
 * Get plans by status
 */
export async function getPlansByStatus(status: number): Promise<Plan[]> {
  const result = await query(
    'SELECT * FROM public.plan WHERE status = $1 ORDER BY start_time DESC',
    [status]
  );
  return result.rows;
}

/**
 * Get public plans
 */
export async function getPublicPlans(): Promise<Plan[]> {
  const result = await query(
    'SELECT * FROM public.plan WHERE is_public = true ORDER BY start_time DESC'
  );
  return result.rows;
}

/**
 * Get private plans
 */
export async function getPrivatePlans(): Promise<Plan[]> {
  const result = await query(
    'SELECT * FROM public.plan WHERE is_public = false ORDER BY start_time DESC'
  );
  return result.rows;
}

/**
 * Get plans by start time range
 */
export async function getPlansByStartTimeRange(
  startTime: Date | string,
  endTime: Date | string
): Promise<Plan[]> {
  const startTimeDate = startTime instanceof Date ? startTime : new Date(startTime);
  const endTimeDate = endTime instanceof Date ? endTime : new Date(endTime);
  
  const result = await query(
    'SELECT * FROM public.plan WHERE start_time BETWEEN $1 AND $2 ORDER BY start_time ASC',
    [startTimeDate, endTimeDate]
  );
  return result.rows;
}

/**
 * Get upcoming plans (start_time >= now)
 */
export async function getUpcomingPlans(): Promise<Plan[]> {
  const now = new Date();
  const result = await query(
    'SELECT * FROM public.plan WHERE start_time >= $1 ORDER BY start_time ASC',
    [now]
  );
  return result.rows;
}

/**
 * Get past plans (start_time < now)
 */
export async function getPastPlans(): Promise<Plan[]> {
  const now = new Date();
  const result = await query(
    'SELECT * FROM public.plan WHERE start_time < $1 ORDER BY start_time DESC',
    [now]
  );
  return result.rows;
}

/**
 * Get plans happening today
 */
export async function getTodayPlans(): Promise<Plan[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const result = await query(
    'SELECT * FROM public.plan WHERE start_time >= $1 AND start_time < $2 ORDER BY start_time ASC',
    [today, tomorrow]
  );
  return result.rows;
}

/**
 * Get plans happening this week
 */
export async function getThisWeekPlans(): Promise<Plan[]> {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  
  const result = await query(
    'SELECT * FROM public.plan WHERE start_time >= $1 AND start_time < $2 ORDER BY start_time ASC',
    [startOfWeek, endOfWeek]
  );
  return result.rows;
}

/**
 * Get plans happening this month
 */
export async function getThisMonthPlans(): Promise<Plan[]> {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  
  const result = await query(
    'SELECT * FROM public.plan WHERE start_time >= $1 AND start_time < $2 ORDER BY start_time ASC',
    [startOfMonth, endOfMonth]
  );
  return result.rows;
}

/**
 * Get plans by multiple statuses
 */
export async function getPlansByStatuses(statuses: number[]): Promise<Plan[]> {
  if (statuses.length === 0) {
    return [];
  }
  
  const placeholders = statuses.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `SELECT * FROM public.plan WHERE status IN (${placeholders}) ORDER BY start_time DESC`,
    statuses
  );
  return result.rows;
}

/**
 * Get public upcoming plans
 */
export async function getPublicUpcomingPlans(): Promise<Plan[]> {
  const now = new Date();
  const result = await query(
    'SELECT * FROM public.plan WHERE is_public = true AND start_time >= $1 ORDER BY start_time ASC',
    [now]
  );
  return result.rows;
}

/**
 * Get plans by prompted_by and status
 */
export async function getPlansByPromptedByAndStatus(
  userId: number,
  status: number
): Promise<Plan[]> {
  const result = await query(
    'SELECT * FROM public.plan WHERE prompted_by = $1 AND status = $2 ORDER BY start_time DESC',
    [userId, status]
  );
  return result.rows;
}

/**
 * Get plans by prompted_by and is_public
 */
export async function getPlansByPromptedByAndPublic(
  userId: number,
  isPublic: boolean
): Promise<Plan[]> {
  const result = await query(
    'SELECT * FROM public.plan WHERE prompted_by = $1 AND is_public = $2 ORDER BY start_time DESC',
    [userId, isPublic]
  );
  return result.rows;
}

/**
 * Get plans count
 */
export async function getPlansCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.plan');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plans count by prompted_by
 */
export async function getPlansCountByPromptedBy(userId: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan WHERE prompted_by = $1',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plans count by status
 */
export async function getPlansCountByStatus(status: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan WHERE status = $1',
    [status]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if plan exists
 */
export async function planExists(planId: string): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.plan WHERE id = $1',
    [planId]
  );
  return result.rowCount > 0;
}

/**
 * Bulk update plans by status
 */
export async function bulkUpdatePlansStatus(
  planIds: string[],
  newStatus: number
): Promise<number> {
  if (planIds.length === 0) {
    return 0;
  }
  
  const placeholders = planIds.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `UPDATE public.plan SET status = $${planIds.length + 1} WHERE id IN (${placeholders})`,
    [...planIds, newStatus]
  );
  return result.rowCount;
}

/**
 * Bulk delete plans
 */
export async function bulkDeletePlans(planIds: string[]): Promise<number> {
  if (planIds.length === 0) {
    return 0;
  }
  
  const placeholders = planIds.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `DELETE FROM public.plan WHERE id IN (${placeholders})`,
    planIds
  );
  return result.rowCount;
}

