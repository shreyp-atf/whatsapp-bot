/**
 * Conversation Manager
 * 
 * Manages OpenAI conversations and ensures system message is set
 */

import OpenAI from 'openai';
import { getUserById, updateUser, createUser } from '../../../../db/user';
import { loadSystemMessage } from './promptLoader';
import { logger } from '../../../utils/logging';

/**
 * Ensure user has a conversation with system message
 * Creates user if they don't exist (for onboarding flow)
 * Returns null if user doesn't exist and createUserIfNotExists is false (for Master Agent)
 */
export async function ensureConversation(
  userId: number,
  client: OpenAI,
  createUserIfNotExists: boolean = false,
  allowMissingUser: boolean = false
): Promise<string | null> {
  let user = await getUserById(userId);

  // Create user if they don't exist and flag is set
  if (!user && createUserIfNotExists) {
    user = await createUser({
      user_id: userId,
    });
    logger.info('Created new user in ensureConversation', {
      userId,
    });
  }

  // Allow missing user for Master Agent (it will check and route to Onboarding)
  if (!user && allowMissingUser) {
    return null;
  }

  if (!user) {
    throw new Error(`User with ID ${userId} not found. User must be created first.`);
  }

  // If user already has a conversation_id, return it
  if (user.conversation_id) {
    return user.conversation_id;
  }

  // Load system message
  const systemMessage = loadSystemMessage();

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

  // Update user with the new conversation_id
  await updateUser(userId, {
    conversation_id: conversation.id,
  });

  logger.info('Created new conversation for user', {
    userId,
    conversationId: conversation.id,
  });

  return conversation.id;
}

/**
 * Add agent context to a message
 * This is added to the user message when routing to a different agent
 */
export function addAgentContext(
  message: string,
  agentName: string,
  agentPrompt: string
): string {
  return `[Agent Context: ${agentName}]\n${agentPrompt}\n\n[User Message]\n${message}`;
}
