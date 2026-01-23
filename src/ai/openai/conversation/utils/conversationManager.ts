/**
 * Conversation Manager
 * 
 * Manages OpenAI conversations and ensures system message is set
 */

import OpenAI from 'openai';
import { getUserById, updateUser, createUser } from '../../../../db/user';
import { loadSystemMessage } from './promptLoader';
import { logger } from '../../../utils/logging';
import { User } from '../../../../types/database';

/**
 * Ensure user has a conversation with system message
 * Creates user if they don't exist (for onboarding flow)
 * Returns null if user doesn't exist and createUserIfNotExists is false (for Master Agent)
 * 
 * Note: System message checking is not performed. System message updates should be handled
 * separately when prompts change, not during normal message processing.
 * 
 * @param agentPrompt - The agent's prompt to use as system message. If not provided, uses global systemMessage.md
 * @param agentName - The agent name. 'master' or undefined uses conversation_id, others use agent_conversation_ids
 * @param user - Optional user object (if provided, avoids database fetch)
 */
export async function ensureConversation(
  userId: number,
  client: OpenAI,
  createUserIfNotExists: boolean = false,
  allowMissingUser: boolean = false,
  agentPrompt?: string,
  agentName?: string,
  user?: User
): Promise<string | null> {
  const isMasterAgent = !agentName || agentName === 'master';
  
  logger.info('Conversation Manager: ensureConversation - Entry', {
    operation: 'ensureConversation',
    userId,
    createUserIfNotExists,
    allowMissingUser,
    agentName: agentName || 'master',
    isMasterAgent,
    hasAgentPrompt: !!agentPrompt,
    hasUserObject: !!user,
  });
  
  let userData = user || await getUserById(userId);

  // Create user if they don't exist and flag is set
  if (!user && createUserIfNotExists) {
    logger.info('Conversation Manager: ensureConversation - Creating user', {
      operation: 'ensureConversation',
      userId,
    });
    
    user = await createUser({
      user_id: userId,
    });
    
    logger.info('Conversation Manager: ensureConversation - User created', {
      operation: 'ensureConversation',
      userId,
    });
  }

  // Allow missing user for Master Agent (it will check and route to Onboarding)
  if (!user && allowMissingUser) {
    logger.info('Conversation Manager: ensureConversation - User missing, returning null (allowed)', {
      operation: 'ensureConversation',
      userId,
      allowMissingUser: true,
    });
    return null;
  }

  if (!user) {
    logger.error('Conversation Manager: ensureConversation - User not found', new Error('User not found'), {
      operation: 'ensureConversation',
      userId,
    });
    throw new Error(`User with ID ${userId} not found. User must be created first.`);
  }

  // Determine which conversation to use/check
  let existingConversationId: string | null = null;
  
  if (isMasterAgent) {
    // Master Agent uses conversation_id
    existingConversationId = user.conversation_id || null;
  } else {
    // Sub-agents use agent_conversation_ids
    const agentConversationIds = user.agent_conversation_ids || {};
    existingConversationId = agentConversationIds[agentName] || null;
  }

  // If conversation exists, return it immediately (no system message check)
  if (existingConversationId) {
    logger.info('Conversation Manager: ensureConversation - Exit (existing conversation)', {
      operation: 'ensureConversation',
      userId,
      agentName: agentName || 'master',
      conversationId: existingConversationId,
      isMasterAgent,
    });
    return existingConversationId;
  }

  // Load system message (use agentPrompt if provided, otherwise use global)
  const systemMessage = agentPrompt || loadSystemMessage();
  
  logger.info('Conversation Manager: ensureConversation - Creating new conversation', {
    operation: 'ensureConversation',
    userId,
    agentName: agentName || 'master',
    isMasterAgent,
    systemMessageLength: systemMessage.length,
    usingAgentPrompt: !!agentPrompt,
  });

  // Create a new conversation with system message
  const conversation = await client.conversations.create({
    items: [
      {
        type: 'message',
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: systemMessage,
          },
        ],
      },
    ],
  });

  logger.info('Conversation Manager: ensureConversation - Conversation created', {
    operation: 'ensureConversation',
    userId,
    agentName: agentName || 'master',
    conversationId: conversation.id,
  });

  // Update user with the conversation ID in the appropriate field
  if (isMasterAgent) {
    await updateUser(userId, {
      conversation_id: conversation.id,
    });
  } else {
    // Update agent_conversation_ids for sub-agents
    const currentAgentIds = user.agent_conversation_ids || {};
    await updateUser(userId, {
      agent_conversation_ids: {
        ...currentAgentIds,
        [agentName]: conversation.id,
      },
    });
  }

  logger.info('Conversation Manager: ensureConversation - Exit (new conversation)', {
    operation: 'ensureConversation',
    userId,
    agentName: agentName || 'master',
    conversationId: conversation.id,
    conversationCreated: true,
    storedIn: isMasterAgent ? 'conversation_id' : 'agent_conversation_ids',
  });

  return conversation.id;
}

/**
 * Update prompts for a user's conversation
 * Creates a new conversation with updated system message while preserving message history
 * 
 * @param userId - User ID
 * @param client - OpenAI client
 * @param newSystemMessage - The new system message/prompt to use
 * @param agentName - Optional agent name. If not provided or 'master', updates conversation_id. Otherwise updates agent_conversation_ids
 * @returns The new conversation ID
 */
export async function updatePrompts(
  userId: number,
  client: OpenAI,
  newSystemMessage: string,
  agentName?: string
): Promise<string> {
  const isMasterAgent = !agentName || agentName === 'master';
  
  logger.info('Conversation Manager: updatePrompts - Entry', {
    operation: 'updatePrompts',
    userId,
    agentName: agentName || 'master',
    isMasterAgent,
    newSystemMessageLength: newSystemMessage.length,
  });
  
  // Get user
  const user = await getUserById(userId);
  
  if (!user) {
    logger.error('Conversation Manager: updatePrompts - User not found', new Error('User not found'), {
      operation: 'updatePrompts',
      userId,
    });
    throw new Error(`User with ID ${userId} not found.`);
  }
  
  // Get existing conversation ID
  let existingConversationId: string | null = null;
  
  if (isMasterAgent) {
    existingConversationId = user.conversation_id || null;
  } else {
    const agentConversationIds = user.agent_conversation_ids || {};
    existingConversationId = agentConversationIds[agentName] || null;
  }
  
  if (!existingConversationId) {
    logger.error('Conversation Manager: updatePrompts - No existing conversation found', new Error('No conversation found'), {
      operation: 'updatePrompts',
      userId,
      agentName: agentName || 'master',
    });
    throw new Error(`No existing conversation found for user ${userId}${agentName ? ` and agent ${agentName}` : ''}.`);
  }
  
  logger.info('Conversation Manager: updatePrompts - Fetching existing conversation messages', {
    operation: 'updatePrompts',
    userId,
    agentName: agentName || 'master',
    existingConversationId,
  });
  
  // Fetch all messages from existing conversation (excluding system messages)
  const existingItems = await client.conversations.items.list(existingConversationId, {
    limit: 1000, // Get all messages
    order: 'asc', // Preserve chronological order
  });
  
  const messagesToCopy: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];
  
  for await (const item of existingItems) {
    if (item.type === 'message' && 'role' in item && 'content' in item) {
      const message = item as any;
      const role = message.role as 'user' | 'assistant' | 'system';
      
      // Skip system messages - we'll add a new one
      if (role === 'system') {
        continue;
      }
      
      // Extract text content
      let textContent = '';
      if (Array.isArray(message.content)) {
        for (const contentItem of message.content) {
          if (contentItem.type === 'text' && 'text' in contentItem) {
            textContent += contentItem.text;
          } else if (contentItem.type === 'input_text' && 'text' in contentItem) {
            textContent += contentItem.text;
          }
        }
      }
      
      if (textContent && (role === 'user' || role === 'assistant')) {
        messagesToCopy.push({
          role: role as 'user' | 'assistant',
          content: textContent,
        });
      }
    }
  }
  
  logger.info('Conversation Manager: updatePrompts - Messages extracted', {
    operation: 'updatePrompts',
    userId,
    agentName: agentName || 'master',
    messageCount: messagesToCopy.length,
    userMessageCount: messagesToCopy.filter(m => m.role === 'user').length,
    assistantMessageCount: messagesToCopy.filter(m => m.role === 'assistant').length,
  });
  
  // Create new conversation with updated system message
  logger.info('Conversation Manager: updatePrompts - Creating new conversation', {
    operation: 'updatePrompts',
    userId,
    agentName: agentName || 'master',
    systemMessageLength: newSystemMessage.length,
  });
  
  const newConversation = await client.conversations.create({
    items: [
      {
        type: 'message',
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: newSystemMessage,
          },
        ],
      },
    ],
  });
  
  logger.info('Conversation Manager: updatePrompts - New conversation created', {
    operation: 'updatePrompts',
    userId,
    agentName: agentName || 'master',
    newConversationId: newConversation.id,
  });
  
  // Copy all messages to the new conversation
  if (messagesToCopy.length > 0) {
    logger.info('Conversation Manager: updatePrompts - Copying messages to new conversation', {
      operation: 'updatePrompts',
      userId,
      agentName: agentName || 'master',
      messageCount: messagesToCopy.length,
    });
    
    // Add messages in batches if needed (OpenAI API may have limits)
    const batchSize = 50; // Reasonable batch size
    for (let i = 0; i < messagesToCopy.length; i += batchSize) {
      const batch = messagesToCopy.slice(i, i + batchSize);
      
      await client.conversations.items.create(newConversation.id, {
        items: batch.map(msg => ({
          type: 'message' as const,
          role: msg.role,
          content: [
            {
              type: 'input_text' as const,
              text: msg.content,
            },
          ],
        })),
      });
      
      logger.info('Conversation Manager: updatePrompts - Batch copied', {
        operation: 'updatePrompts',
        userId,
        agentName: agentName || 'master',
        batchStart: i,
        batchEnd: Math.min(i + batchSize, messagesToCopy.length),
        totalMessages: messagesToCopy.length,
      });
    }
  }
  
  // Update user with the new conversation ID
  if (isMasterAgent) {
    await updateUser(userId, {
      conversation_id: newConversation.id,
    });
  } else {
    const currentAgentIds = user.agent_conversation_ids || {};
    await updateUser(userId, {
      agent_conversation_ids: {
        ...currentAgentIds,
        [agentName]: newConversation.id,
      },
    });
  }
  
  logger.info('Conversation Manager: updatePrompts - Exit (Success)', {
    operation: 'updatePrompts',
    userId,
    agentName: agentName || 'master',
    oldConversationId: existingConversationId,
    newConversationId: newConversation.id,
    messagesCopied: messagesToCopy.length,
    storedIn: isMasterAgent ? 'conversation_id' : 'agent_conversation_ids',
  });
  
  return newConversation.id;
}

// Note: addAgentContext function removed - prompts are now used as system messages, not message content
