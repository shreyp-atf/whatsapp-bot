/**
 * User database operations
 */

import { query } from './connection';
import { CreateUserInput, User } from '../types/database';

/**
 * Get user by user_id (contact number)
 */
export async function getUserById(userId: number): Promise<User | null> {
  const result = await query('SELECT * FROM public.user WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
}

/**
 * Create a new user profile
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const { user_id, name, bio, persona_json, locality_id, conversation_id } = input;
  const now = new Date();
  
  const result = await query(
    `INSERT INTO public.user (user_id, created_at, updated_at, name, bio, persona_json, locality_id, conversation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [user_id, now, now, name || null, bio || null, persona_json || null, locality_id || null, conversation_id || null]
  );
  
  return result.rows[0];
}

/**
 * Update user profile
 */
export async function updateUser(userId: number, updates: Partial<CreateUserInput>): Promise<User> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.bio !== undefined) {
    fields.push(`bio = $${paramIndex++}`);
    values.push(updates.bio);
  }
  if (updates.persona_json !== undefined) {
    fields.push(`persona_json = $${paramIndex++}`);
    values.push(updates.persona_json);
  }
  if (updates.locality_id !== undefined) {
    fields.push(`locality_id = $${paramIndex++}`);
    values.push(updates.locality_id);
  }
  if (updates.conversation_id !== undefined) {
    fields.push(`conversation_id = $${paramIndex++}`);
    values.push(updates.conversation_id);
  }
  
  fields.push(`updated_at = $${paramIndex++}`);
  values.push(new Date());
  values.push(userId);
  
  const result = await query(
    `UPDATE public.user SET ${fields.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
    values
  );
  
  return result.rows[0];
}

/**
 * Extract user ID (contact number) from chat_id
 * For 1:1 chats, chat_id format is: <contact_number>@c.us
 */
export function extractUserIdFromChatId(chatId: string): number | null {
  if (chatId.endsWith('@c.us')) {
    const contactNumber = chatId.replace('@c.us', '');
    const userId = parseInt(contactNumber, 10);
    if (!isNaN(userId)) {
      return userId;
    }
  }
  return null;
}

/**
 * Check if chat_id represents a 1:1 chat
 */
export function isOneOnOneChat(chatId: string): boolean {
  return chatId.endsWith('@c.us');
}

/**
 * Get user persona by user_id
 * Returns the persona_json field from the user table
 */
export async function getUserPersona(userId: number): Promise<any | null> {
  const user = await getUserById(userId);
  return user?.persona_json || null;
}

