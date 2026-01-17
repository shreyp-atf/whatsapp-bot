/**
 * Plan Participant database operations
 */

import { query } from './connection';
import { PlanParticipant, CreatePlanParticipantInput, UpdatePlanParticipantInput } from '../types/database';

/**
 * Get plan participant by id
 */
export async function getPlanParticipantById(id: number): Promise<PlanParticipant | null> {
  const result = await query('SELECT * FROM public.plan_participant WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get all plan participants
 */
export async function getAllPlanParticipants(): Promise<PlanParticipant[]> {
  const result = await query('SELECT * FROM public.plan_participant ORDER BY created_at DESC');
  return result.rows;
}

/**
 * Create a new plan participant
 */
export async function createPlanParticipant(input: CreatePlanParticipantInput): Promise<PlanParticipant> {
  const { plan_id, user_id, status, invited_by, interest_tier, friend_tier } = input;
  
  const result = await query(
    `INSERT INTO public.plan_participant (plan_id, user_id, status, invited_by, interest_tier, friend_tier)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [plan_id, user_id, status, invited_by, interest_tier, friend_tier]
  );
  
  return result.rows[0];
}

/**
 * Update a plan participant
 */
export async function updatePlanParticipant(
  id: number,
  updates: UpdatePlanParticipantInput
): Promise<PlanParticipant> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.interest_tier !== undefined) {
    fields.push(`interest_tier = $${paramIndex++}`);
    values.push(updates.interest_tier);
  }
  if (updates.friend_tier !== undefined) {
    fields.push(`friend_tier = $${paramIndex++}`);
    values.push(updates.friend_tier);
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  values.push(id);
  
  const result = await query(
    `UPDATE public.plan_participant SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  if (!result.rows[0]) {
    throw new Error(`Plan participant with id ${id} not found`);
  }
  
  return result.rows[0];
}

/**
 * Delete a plan participant
 */
export async function deletePlanParticipant(id: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM public.plan_participant WHERE id = $1 RETURNING id',
    [id]
  );
  
  return result.rowCount > 0;
}

/**
 * Get plan participants by plan_id
 */
export async function getPlanParticipantsByPlanId(planId: string): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE plan_id = $1 ORDER BY created_at ASC',
    [planId]
  );
  return result.rows;
}

/**
 * Get plan participants by user_id
 */
export async function getPlanParticipantsByUserId(userId: number): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

/**
 * Get plan participants by status
 */
export async function getPlanParticipantsByStatus(status: number): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE status = $1 ORDER BY created_at DESC',
    [status]
  );
  return result.rows;
}

/**
 * Get plan participants by invited_by
 */
export async function getPlanParticipantsByInvitedBy(userId: number): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE invited_by = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

/**
 * Get plan participants by interest_tier
 */
export async function getPlanParticipantsByInterestTier(interestTier: number): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE interest_tier = $1 ORDER BY created_at DESC',
    [interestTier]
  );
  return result.rows;
}

/**
 * Get plan participants by friend_tier
 */
export async function getPlanParticipantsByFriendTier(friendTier: number): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE friend_tier = $1 ORDER BY created_at DESC',
    [friendTier]
  );
  return result.rows;
}

/**
 * Get plan participants by interest_tier range
 */
export async function getPlanParticipantsByInterestTierRange(
  minTier: number,
  maxTier: number
): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE interest_tier BETWEEN $1 AND $2 ORDER BY interest_tier ASC, created_at DESC',
    [minTier, maxTier]
  );
  return result.rows;
}

/**
 * Get plan participants by friend_tier range
 */
export async function getPlanParticipantsByFriendTierRange(
  minTier: number,
  maxTier: number
): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE friend_tier BETWEEN $1 AND $2 ORDER BY friend_tier ASC, created_at DESC',
    [minTier, maxTier]
  );
  return result.rows;
}

/**
 * Get plan participant by plan_id and user_id (unique combination)
 */
export async function getPlanParticipantByPlanAndUser(
  planId: string,
  userId: number
): Promise<PlanParticipant | null> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE plan_id = $1 AND user_id = $2',
    [planId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Get plan participants by plan_id and status
 */
export async function getPlanParticipantsByPlanIdAndStatus(
  planId: string,
  status: number
): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE plan_id = $1 AND status = $2 ORDER BY created_at ASC',
    [planId, status]
  );
  return result.rows;
}

/**
 * Get plan participants by user_id and status
 */
export async function getPlanParticipantsByUserIdAndStatus(
  userId: number,
  status: number
): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
    [userId, status]
  );
  return result.rows;
}

/**
 * Get plan participants by plan_id and invited_by
 */
export async function getPlanParticipantsByPlanIdAndInvitedBy(
  planId: string,
  invitedBy: number
): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE plan_id = $1 AND invited_by = $2 ORDER BY created_at ASC',
    [planId, invitedBy]
  );
  return result.rows;
}

/**
 * Get plan participants by multiple statuses
 */
export async function getPlanParticipantsByStatuses(statuses: number[]): Promise<PlanParticipant[]> {
  if (statuses.length === 0) {
    return [];
  }
  
  const placeholders = statuses.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `SELECT * FROM public.plan_participant WHERE status IN (${placeholders}) ORDER BY created_at DESC`,
    statuses
  );
  return result.rows;
}

/**
 * Get plan participants by multiple plan_ids
 */
export async function getPlanParticipantsByPlanIds(planIds: string[]): Promise<PlanParticipant[]> {
  if (planIds.length === 0) {
    return [];
  }
  
  const placeholders = planIds.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `SELECT * FROM public.plan_participant WHERE plan_id IN (${placeholders}) ORDER BY plan_id, created_at ASC`,
    planIds
  );
  return result.rows;
}

/**
 * Get plan participants by multiple user_ids
 */
export async function getPlanParticipantsByUserIds(userIds: number[]): Promise<PlanParticipant[]> {
  if (userIds.length === 0) {
    return [];
  }
  
  const placeholders = userIds.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `SELECT * FROM public.plan_participant WHERE user_id IN (${placeholders}) ORDER BY created_at DESC`,
    userIds
  );
  return result.rows;
}

/**
 * Get plan participants count
 */
export async function getPlanParticipantsCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM public.plan_participant');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plan participants count by plan_id
 */
export async function getPlanParticipantsCountByPlanId(planId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan_participant WHERE plan_id = $1',
    [planId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plan participants count by user_id
 */
export async function getPlanParticipantsCountByUserId(userId: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan_participant WHERE user_id = $1',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plan participants count by status
 */
export async function getPlanParticipantsCountByStatus(status: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan_participant WHERE status = $1',
    [status]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get plan participants count by plan_id and status
 */
export async function getPlanParticipantsCountByPlanIdAndStatus(
  planId: string,
  status: number
): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM public.plan_participant WHERE plan_id = $1 AND status = $2',
    [planId, status]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if plan participant exists
 */
export async function planParticipantExists(id: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.plan_participant WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

/**
 * Check if user is participant in plan
 */
export async function isUserParticipantInPlan(planId: string, userId: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM public.plan_participant WHERE plan_id = $1 AND user_id = $2',
    [planId, userId]
  );
  return result.rowCount > 0;
}

/**
 * Bulk update plan participants by status
 */
export async function bulkUpdatePlanParticipantsStatus(
  ids: number[],
  newStatus: number
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `UPDATE public.plan_participant SET status = $${ids.length + 1} WHERE id IN (${placeholders})`,
    [...ids, newStatus]
  );
  return result.rowCount;
}

/**
 * Bulk update plan participants by plan_id and status
 */
export async function bulkUpdatePlanParticipantsStatusByPlan(
  planId: string,
  newStatus: number
): Promise<number> {
  const result = await query(
    'UPDATE public.plan_participant SET status = $1 WHERE plan_id = $2',
    [newStatus, planId]
  );
  return result.rowCount;
}

/**
 * Bulk delete plan participants
 */
export async function bulkDeletePlanParticipants(ids: number[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `DELETE FROM public.plan_participant WHERE id IN (${placeholders})`,
    ids
  );
  return result.rowCount;
}

/**
 * Delete all plan participants for a plan
 */
export async function deleteAllPlanParticipantsByPlanId(planId: string): Promise<number> {
  const result = await query(
    'DELETE FROM public.plan_participant WHERE plan_id = $1',
    [planId]
  );
  return result.rowCount;
}

/**
 * Delete all plan participants for a user
 */
export async function deleteAllPlanParticipantsByUserId(userId: number): Promise<number> {
  const result = await query(
    'DELETE FROM public.plan_participant WHERE user_id = $1',
    [userId]
  );
  return result.rowCount;
}

/**
 * Update plan participant by plan_id and user_id
 */
export async function updatePlanParticipantByPlanAndUser(
  planId: string,
  userId: number,
  updates: UpdatePlanParticipantInput
): Promise<PlanParticipant> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.interest_tier !== undefined) {
    fields.push(`interest_tier = $${paramIndex++}`);
    values.push(updates.interest_tier);
  }
  if (updates.friend_tier !== undefined) {
    fields.push(`friend_tier = $${paramIndex++}`);
    values.push(updates.friend_tier);
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  values.push(planId, userId);
  
  const result = await query(
    `UPDATE public.plan_participant SET ${fields.join(', ')} WHERE plan_id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`,
    values
  );
  
  if (!result.rows[0]) {
    throw new Error(`Plan participant with plan_id ${planId} and user_id ${userId} not found`);
  }
  
  return result.rows[0];
}

/**
 * Delete plan participant by plan_id and user_id
 */
export async function deletePlanParticipantByPlanAndUser(
  planId: string,
  userId: number
): Promise<boolean> {
  const result = await query(
    'DELETE FROM public.plan_participant WHERE plan_id = $1 AND user_id = $2 RETURNING id',
    [planId, userId]
  );
  
  return result.rowCount > 0;
}

/**
 * Get plan participants with high interest tier (>= threshold)
 */
export async function getPlanParticipantsWithHighInterestTier(
  threshold: number
): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE interest_tier >= $1 ORDER BY interest_tier DESC, created_at DESC',
    [threshold]
  );
  return result.rows;
}

/**
 * Get plan participants with high friend tier (>= threshold)
 */
export async function getPlanParticipantsWithHighFriendTier(
  threshold: number
): Promise<PlanParticipant[]> {
  const result = await query(
    'SELECT * FROM public.plan_participant WHERE friend_tier >= $1 ORDER BY friend_tier DESC, created_at DESC',
    [threshold]
  );
  return result.rows;
}

