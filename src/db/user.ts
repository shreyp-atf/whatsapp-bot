/**
 * User database operations
 */

import { query } from './connection';
import { CreateUserInput, User } from '../types/database';
import { logger } from '../ai/utils/logging';

/**
 * Get user by user_id (contact number)
 */
export async function getUserById(userId: number): Promise<User | null> {
  logger.info('Database: getUserById - Entry', {
    operation: 'getUserById',
    userId,
  });
  
  const result = await query('SELECT * FROM public.user WHERE user_id = $1', [userId]);
  const user = result.rows[0] || null;
  
  logger.info('Database: getUserById - Exit', {
    operation: 'getUserById',
    userId,
    userFound: !!user,
    hasConversationId: !!user?.conversation_id,
    hasPersona: !!user?.persona_json,
    hasShortTermMemory: !!user?.short_term_memory_json,
    hasAgentConversationIds: !!user?.agent_conversation_ids,
    agentConversationIds: user?.agent_conversation_ids ? Object.keys(user.agent_conversation_ids) : [],
  });
  
  return user;
}

/**
 * Create a new user profile
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  logger.info('Database: createUser - Entry', {
    operation: 'createUser',
    userId: input.user_id,
    hasName: !!input.name,
    hasBio: !!input.bio,
    hasPersona: !!input.persona_json,
    hasShortTermMemory: !!input.short_term_memory_json,
    hasLocalityId: !!input.locality_id,
    hasConversationId: !!input.conversation_id,
    hasAgentConversationIds: !!input.agent_conversation_ids,
  });
  
  const { user_id, name, bio, persona_json, short_term_memory_json, locality_id, conversation_id, agent_conversation_ids } = input;
  const now = new Date();
  
  const result = await query(
    `INSERT INTO public.user (user_id, created_at, updated_at, name, bio, persona_json, short_term_memory_json, locality_id, conversation_id, agent_conversation_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [user_id, now, now, name || null, bio || null, persona_json || null, short_term_memory_json || null, locality_id || null, conversation_id || null, agent_conversation_ids || null]
  );
  
  const createdUser = result.rows[0];
  
  logger.info('Database: createUser - Exit', {
    operation: 'createUser',
    userId: createdUser.user_id,
    createdAt: createdUser.created_at,
    hasConversationId: !!createdUser.conversation_id,
  });
  
  return createdUser;
}

/**
 * Update user profile
 */
export async function updateUser(userId: number, updates: Partial<CreateUserInput>): Promise<User> {
  logger.info('Database: updateUser - Entry', {
    operation: 'updateUser',
    userId,
    updateFields: Object.keys(updates),
    hasName: 'name' in updates,
    hasBio: 'bio' in updates,
    hasPersona: 'persona_json' in updates,
    hasShortTermMemory: 'short_term_memory_json' in updates,
    hasLocalityId: 'locality_id' in updates,
    hasConversationId: 'conversation_id' in updates,
    hasAgentConversationIds: 'agent_conversation_ids' in updates,
  });
  
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
  if (updates.short_term_memory_json !== undefined) {
    fields.push(`short_term_memory_json = $${paramIndex++}`);
    values.push(updates.short_term_memory_json);
  }
  if (updates.locality_id !== undefined) {
    fields.push(`locality_id = $${paramIndex++}`);
    values.push(updates.locality_id);
  }
  if (updates.conversation_id !== undefined) {
    fields.push(`conversation_id = $${paramIndex++}`);
    values.push(updates.conversation_id);
  }
  if (updates.agent_conversation_ids !== undefined) {
    fields.push(`agent_conversation_ids = $${paramIndex++}`);
    values.push(updates.agent_conversation_ids);
  }
  
  fields.push(`updated_at = $${paramIndex++}`);
  values.push(new Date());
  values.push(userId);
  
  logger.info('Database: updateUser - Executing query', {
    operation: 'updateUser',
    userId,
    fieldCount: fields.length,
    fields: fields.map(f => f.split('=')[0].trim()),
  });
  
  const result = await query(
    `UPDATE public.user SET ${fields.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
    values
  );
  
  const updatedUser = result.rows[0];
  
  logger.info('Database: updateUser - Exit', {
    operation: 'updateUser',
    userId,
    updatedAt: updatedUser.updated_at,
    fieldsUpdated: fields.length,
  });
  
  return updatedUser;
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
  logger.info('Database: getUserPersona - Entry', {
    operation: 'getUserPersona',
    userId,
  });
  
  const user = await getUserById(userId);
  const persona = user?.persona_json || null;
  
  logger.info('Database: getUserPersona - Exit', {
    operation: 'getUserPersona',
    userId,
    hasPersona: !!persona,
    personaKeys: persona ? Object.keys(persona) : [],
  });
  
  return persona;
}

