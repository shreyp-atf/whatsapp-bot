/**
 * Memory Manager
 * 
 * Utilities for managing Long Term Memory (persona) and Short Term Memory (conversation state)
 */

import { getUserById, updateUser } from '../../../../db/user';
import { logger } from '../../../../utils/logging';
import { User } from '../../../../types/database';

/**
 * Short Term Memory structure
 */
export interface ShortTermMemory {
  currentPlan?: {
    planId?: string;
    status?: string;
    participants?: number[];
    [key: string]: any;
  };
  activeAgent?: 'onboarding' | 'planning' | 'summary' | null;
  conversationContext?: {
    lastTopic?: string;
    lastIntent?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Get Long Term Memory (user persona)
 */
export async function getLongTermMemory(userId: number, user?: User): Promise<any | null> {
  logger.info('Memory Manager: getLongTermMemory - Entry', {
    operation: 'getLongTermMemory',
    userId,
    hasUserObject: !!user,
  });
  
  try {
    const userData = user || await getUserById(userId);
    const persona = userData?.persona_json || null;
    
    logger.info('Memory Manager: getLongTermMemory - Exit', {
      operation: 'getLongTermMemory',
      userId,
      hasPersona: !!persona,
      personaKeys: persona ? Object.keys(persona) : [],
    });
    
    return persona;
  } catch (error) {
    logger.error('Memory Manager: getLongTermMemory - Error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getLongTermMemory',
      userId,
    });
    return null;
  }
}

/**
 * Get Short Term Memory (conversation state)
 */
export async function getShortTermMemory(userId: number, user?: User): Promise<ShortTermMemory | null> {
  logger.info('Memory Manager: getShortTermMemory - Entry', {
    operation: 'getShortTermMemory',
    userId,
    hasUserObject: !!user,
  });
  
  try {
    const userData = user || await getUserById(userId);
    const memory = userData?.short_term_memory_json || null;
    
    logger.info('Memory Manager: getShortTermMemory - Exit', {
      operation: 'getShortTermMemory',
      userId,
      hasMemory: !!memory,
      activeAgent: memory?.activeAgent || null,
      hasCurrentPlan: !!memory?.currentPlan,
      hasConversationContext: !!memory?.conversationContext,
    });
    
    return memory;
  } catch (error) {
    logger.error('Memory Manager: getShortTermMemory - Error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getShortTermMemory',
      userId,
    });
    return null;
  }
}

/**
 * Update Long Term Memory (user persona)
 */
export async function updateLongTermMemory(userId: number, persona: any): Promise<void> {
  logger.info('Memory Manager: updateLongTermMemory - Entry', {
    operation: 'updateLongTermMemory',
    userId,
    personaKeys: persona ? Object.keys(persona) : [],
    personaSize: persona ? JSON.stringify(persona).length : 0,
  });
  
  try {
    await updateUser(userId, {
      persona_json: persona,
    });
    
    logger.info('Memory Manager: updateLongTermMemory - Exit', {
      operation: 'updateLongTermMemory',
      userId,
      personaKeys: Object.keys(persona || {}),
      personaUpdated: true,
    });
  } catch (error) {
    logger.error('Memory Manager: updateLongTermMemory - Error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'updateLongTermMemory',
      userId,
    });
    throw error;
  }
}

/**
 * Update Short Term Memory (conversation state)
 */
export async function updateShortTermMemory(userId: number, state: ShortTermMemory): Promise<void> {
  logger.info('Memory Manager: updateShortTermMemory - Entry', {
    operation: 'updateShortTermMemory',
    userId,
    activeAgent: state.activeAgent || null,
    hasCurrentPlan: !!state.currentPlan,
    hasConversationContext: !!state.conversationContext,
    stateKeys: Object.keys(state),
  });
  
  try {
    await updateUser(userId, {
      short_term_memory_json: state,
    });
    
    logger.info('Memory Manager: updateShortTermMemory - Exit', {
      operation: 'updateShortTermMemory',
      userId,
      activeAgent: state.activeAgent,
      memoryUpdated: true,
    });
  } catch (error) {
    logger.error('Memory Manager: updateShortTermMemory - Error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'updateShortTermMemory',
      userId,
    });
    throw error;
  }
}

/**
 * Merge updates into Short Term Memory (partial update)
 */
export async function mergeShortTermMemory(userId: number, updates: Partial<ShortTermMemory>, user?: User): Promise<ShortTermMemory> {
  logger.info('Memory Manager: mergeShortTermMemory - Entry', {
    operation: 'mergeShortTermMemory',
    userId,
    updateKeys: Object.keys(updates),
    activeAgent: updates.activeAgent || null,
    hasCurrentPlan: !!updates.currentPlan,
    hasConversationContext: !!updates.conversationContext,
    hasUserObject: !!user,
  });
  
  try {
    const current = await getShortTermMemory(userId, user);
    
    logger.info('Memory Manager: mergeShortTermMemory - Current state retrieved', {
      operation: 'mergeShortTermMemory',
      userId,
      hasCurrent: !!current,
      currentActiveAgent: current?.activeAgent || null,
    });
    
    const merged: ShortTermMemory = {
      ...current,
      ...updates,
      conversationContext: {
        ...current?.conversationContext,
        ...updates.conversationContext,
      },
      currentPlan: {
        ...current?.currentPlan,
        ...updates.currentPlan,
      },
    };
    
    await updateShortTermMemory(userId, merged);
    
    logger.info('Memory Manager: mergeShortTermMemory - Exit', {
      operation: 'mergeShortTermMemory',
      userId,
      mergedActiveAgent: merged.activeAgent,
      memoryMerged: true,
    });
    
    return merged;
  } catch (error) {
    logger.error('Memory Manager: mergeShortTermMemory - Error', error instanceof Error ? error : new Error(String(error)), {
      operation: 'mergeShortTermMemory',
      userId,
    });
    throw error;
  }
}
