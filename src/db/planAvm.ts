/**
 * Plan Activity Venue Map database operations
 */

import { query } from './connection';
import { PlanAvm, CreatePlanAvmInput, UpdatePlanAvmInput } from '../types/database';

/**
 * Get plan_avm by id
 */
export async function getPlanAvmById(id: number): Promise<PlanAvm | null> {
  const result = await query('SELECT * FROM public.plan_avm WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get all plan_avm entries
 */
export async function getAllPlanAvms(): Promise<PlanAvm[]> {
  const result = await query('SELECT * FROM public.plan_avm ORDER BY created_at DESC');
  return result.rows;
}

/**
 * Create a new plan_avm entry
 */
export async function createPlanAvm(input: CreatePlanAvmInput): Promise<PlanAvm> {
  const { plan_id, avm_id } = input;
  
  const result = await query(
    `INSERT INTO public.plan_avm (plan_id, avm_id)
     VALUES ($1, $2)
     RETURNING *`,
    [plan_id, avm_id]
  );
  
  return result.rows[0];
}

/**
 * Update a plan_avm entry
 */
export async function updatePlanAvm(id: number, updates: UpdatePlanAvmInput): Promise<PlanAvm> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.plan_id !== undefined) {
    fields.push(`plan_id = $${paramIndex++}`);
    values.push(updates.plan_id);
  }
  if (updates.avm_id !== undefined) {
    fields.push(`avm_id = $${paramIndex++}`);
    values.push(updates.avm_id);
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  values.push(id);
  
  const result = await query(
    `UPDATE public.plan_avm SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  if (!result.rows[0]) {
    throw new Error(`Plan_avm with id ${id} not found`);
  }
  
  return result.rows[0];
}

/**
 * Delete a plan_avm entry
 */
export async function deletePlanAvm(id: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM public.plan_avm WHERE id = $1 RETURNING id',
    [id]
  );
  
  return result.rowCount > 0;
}

/**
 * Get plan_avm entries by plan_id
 */
export async function getPlanAvmsByPlanId(planId: string): Promise<PlanAvm[]> {
  const result = await query(
    'SELECT * FROM public.plan_avm WHERE plan_id = $1 ORDER BY created_at ASC',
    [planId]
  );
  return result.rows;
}

/**
 * Get plan_avm entries by avm_id
 */
export async function getPlanAvmsByAvmId(avmId: number): Promise<PlanAvm[]> {
  const result = await query(
    'SELECT * FROM public.plan_avm WHERE avm_id = $1 ORDER BY created_at ASC',
    [avmId]
  );
  return result.rows;
}

/**
 * Get plan_avm entry by plan_id and avm_id (unique combination)
 */
export async function getPlanAvmByPlanAndAvm(
  planId: string,
  avmId: number
): Promise<PlanAvm | null> {
  const result = await query(
    'SELECT * FROM public.plan_avm WHERE plan_id = $1 AND avm_id = $2',
    [planId, avmId]
  );
  return result.rows[0] || null;
}

/**
 * Get plan_avm entries by multiple plan_ids
 */
export async function getPlanAvmsByPlanIds(planIds: string[]): Promise<PlanAvm[]> {
  if (planIds.length === 0) {
    return [];
  }
  
  const placeholders = planIds.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `SELECT * FROM public.plan_avm WHERE plan_id IN (${placeholders}) ORDER BY plan_id, created_at ASC`,
    planIds
  );
  return result.rows;
}

/**
 * Get plan_avm entries by multiple avm_ids
 */
export async function getPlanAvmsByAvmIds(avmIds: number[]): Promise<PlanAvm[]> {
  if (avmIds.length === 0) {
    return [];
  }
  
  const placeholders = avmIds.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `SELECT * FROM public.plan_avm WHERE avm_id IN (${placeholders}) ORDER BY avm_id, created_at ASC`,
    avmIds
  );
  return result.rows;
}

/**
 * Get plan_avm entries created within a date range
 */
export async function getPlanAvmsByDateRange(
  startDate: Date | string,
  endDate: Date | string
): Promise<PlanAvm[]> {
  const startDateDate = startDate instanceof Date ? startDate : new Date(startDate);
  const endDateDate = endDate instanceof Date ? endDate : new Date(endDate);
  
  const result = await query(
    'SELECT * FROM public.plan_avm WHERE created_at BETWEEN $1 AND $2 ORDER BY created_at ASC',
    [startDateDate, endDateDate]
  );
  return result.rows;
}

/**
 * Get plan_avm entries created today
 */
export async function getTodayPlanAvms(): Promise<PlanAvm[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const result = await query(
    'SELECT * FROM public.plan_avm WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',
    [today, tomorrow]
  );
  return result.rows;
}

/**
 * Get plan_avm entries created this week
 */
export async function getThisWeekPlanAvms(): Promise<PlanAvm[]> {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  
  const result = await query(
    'SELECT * FROM public.plan_avm WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',
    [startOfWeek, endOfWeek]
  );
  return result.rows;
}

/**
 * Get plan_avm entries created this month
 */
export async function getThisMonthPlanAvms(): Promise<PlanAvm[]> {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  
  const result = await query(
    'SELECT * FROM public.plan_avm WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',
    [startOfMonth, endOfMonth]
  );
  return result.rows;
}

/**
 * Get plan_avm count
 */
export async function getPlanAvmsCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.plan_avm');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plan_avm count by plan_id
 */
export async function getPlanAvmsCountByPlanId(planId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan_avm WHERE plan_id = $1',
    [planId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plan_avm count by avm_id
 */
export async function getPlanAvmsCountByAvmId(avmId: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan_avm WHERE avm_id = $1',
    [avmId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if plan_avm exists
 */
export async function planAvmExists(id: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.plan_avm WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

/**
 * Check if plan has avm
 */
export async function planHasAvm(planId: string, avmId: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.plan_avm WHERE plan_id = $1 AND avm_id = $2',
    [planId, avmId]
  );
  return result.rowCount > 0;
}

/**
 * Bulk create plan_avm entries
 */
export async function bulkCreatePlanAvms(inputs: CreatePlanAvmInput[]): Promise<PlanAvm[]> {
  if (inputs.length === 0) {
    return [];
  }
  
  const values: any[] = [];
  const placeholders: string[] = [];
  
  inputs.forEach((input, index) => {
    const baseIndex = index * 2;
    placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2})`);
    values.push(input.plan_id, input.avm_id);
  });
  
  const result = await query(
    `INSERT INTO public.plan_avm (plan_id, avm_id) VALUES ${placeholders.join(', ')} RETURNING *`,
    values
  );
  
  return result.rows;
}

/**
 * Bulk delete plan_avm entries
 */
export async function bulkDeletePlanAvms(ids: number[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `DELETE FROM public.plan_avm WHERE id IN (${placeholders})`,
    ids
  );
  return result.rowCount;
}

/**
 * Delete all plan_avm entries for a plan
 */
export async function deleteAllPlanAvmsByPlanId(planId: string): Promise<number> {
  const result = await query(
    'DELETE FROM public.plan_avm WHERE plan_id = $1',
    [planId]
  );
  return result.rowCount;
}

/**
 * Delete all plan_avm entries for an avm
 */
export async function deleteAllPlanAvmsByAvmId(avmId: number): Promise<number> {
  const result = await query(
    'DELETE FROM public.plan_avm WHERE avm_id = $1',
    [avmId]
  );
  return result.rowCount;
}

/**
 * Delete plan_avm entry by plan_id and avm_id
 */
export async function deletePlanAvmByPlanAndAvm(
  planId: string,
  avmId: number
): Promise<boolean> {
  const result = await query(
    'DELETE FROM public.plan_avm WHERE plan_id = $1 AND avm_id = $2 RETURNING id',
    [planId, avmId]
  );
  
  return result.rowCount > 0;
}

/**
 * Update plan_avm entry by plan_id and avm_id
 */
export async function updatePlanAvmByPlanAndAvm(
  planId: string,
  avmId: number,
  updates: UpdatePlanAvmInput
): Promise<PlanAvm> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.plan_id !== undefined) {
    fields.push(`plan_id = $${paramIndex++}`);
    values.push(updates.plan_id);
  }
  if (updates.avm_id !== undefined) {
    fields.push(`avm_id = $${paramIndex++}`);
    values.push(updates.avm_id);
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  values.push(planId, avmId);
  
  const result = await query(
    `UPDATE public.plan_avm SET ${fields.join(', ')} WHERE plan_id = $${paramIndex} AND avm_id = $${paramIndex + 1} RETURNING *`,
    values
  );
  
  if (!result.rows[0]) {
    throw new Error(`Plan_avm with plan_id ${planId} and avm_id ${avmId} not found`);
  }
  
  return result.rows[0];
}

/**
 * Get unique plan_ids from plan_avm entries
 */
export async function getUniquePlanIds(): Promise<string[]> {
  const result = await query('SELECT DISTINCT plan_id FROM public.plan_avm ORDER BY plan_id');
  return result.rows.map((row: any) => row.plan_id);
}

/**
 * Get unique avm_ids from plan_avm entries
 */
export async function getUniqueAvmIds(): Promise<number[]> {
  const result = await query('SELECT DISTINCT avm_id FROM public.plan_avm ORDER BY avm_id');
  return result.rows.map((row: any) => row.avm_id);
}

/**
 * Get plan_avm entries with joined plan information
 * Returns plan_avm entries with plan details
 */
export async function getPlanAvmsWithPlanDetails(): Promise<any[]> {
  const result = await query(
    `SELECT pa.*, p.created_at as plan_created_at, p.start_time, p.prompted_by, p.status as plan_status, p.is_public
     FROM public.plan_avm pa
     INNER JOIN public.plan p ON pa.plan_id = p.id
     ORDER BY pa.created_at DESC`
  );
  return result.rows;
}

/**
 * Get plan_avm entries with joined avm information
 * Returns plan_avm entries with activity_venue_map details
 */
export async function getPlanAvmsWithAvmDetails(): Promise<any[]> {
  const result = await query(
    `SELECT pa.*, avm.created_at as avm_created_at, avm.activity_id, avm.venue_id, avm.start_time, avm.end_time, 
            avm.is_active, avm.is_public as avm_is_public, avm.max_people, avm.parallel_slots, 
            avm.is_hosted, avm.date, avm.is_ticketed, avm.ticket_price, avm.description, avm.img_url, avm.booking_link
     FROM public.plan_avm pa
     INNER JOIN public.activity_venue_map avm ON pa.avm_id = avm.id
     ORDER BY pa.created_at DESC`
  );
  return result.rows;
}

/**
 * Get plan_avm entries with both plan and avm information
 * Returns plan_avm entries with full plan and activity_venue_map details
 */
export async function getPlanAvmsWithFullDetails(): Promise<any[]> {
  const result = await query(
    `SELECT pa.*, 
            p.created_at as plan_created_at, p.start_time as plan_start_time, p.prompted_by, p.status as plan_status, p.is_public as plan_is_public,
            avm.created_at as avm_created_at, avm.activity_id, avm.venue_id, avm.start_time as avm_start_time, avm.end_time, 
            avm.is_active, avm.is_public as avm_is_public, avm.max_people, avm.parallel_slots, 
            avm.is_hosted, avm.date, avm.is_ticketed, avm.ticket_price, avm.description, avm.img_url, avm.booking_link
     FROM public.plan_avm pa
     INNER JOIN public.plan p ON pa.plan_id = p.id
     INNER JOIN public.activity_venue_map avm ON pa.avm_id = avm.id
     ORDER BY pa.created_at DESC`
  );
  return result.rows;
}

/**
 * Get plan_avm entries for a plan with avm details
 */
export async function getPlanAvmsByPlanIdWithAvmDetails(planId: string): Promise<any[]> {
  const result = await query(
    `SELECT pa.*, avm.created_at as avm_created_at, avm.activity_id, avm.venue_id, avm.start_time, avm.end_time, 
            avm.is_active, avm.is_public as avm_is_public, avm.max_people, avm.parallel_slots, 
            avm.is_hosted, avm.date, avm.is_ticketed, avm.ticket_price, avm.description, avm.img_url, avm.booking_link
     FROM public.plan_avm pa
     INNER JOIN public.activity_venue_map avm ON pa.avm_id = avm.id
     WHERE pa.plan_id = $1
     ORDER BY avm.date ASC, avm.start_time ASC`,
    [planId]
  );
  return result.rows;
}

/**
 * Get plan_avm entries for an avm with plan details
 */
export async function getPlanAvmsByAvmIdWithPlanDetails(avmId: number): Promise<any[]> {
  const result = await query(
    `SELECT pa.*, p.created_at as plan_created_at, p.start_time, p.prompted_by, p.status as plan_status, p.is_public
     FROM public.plan_avm pa
     INNER JOIN public.plan p ON pa.plan_id = p.id
     WHERE pa.avm_id = $1
     ORDER BY p.start_time ASC`,
    [avmId]
  );
  return result.rows;
}

