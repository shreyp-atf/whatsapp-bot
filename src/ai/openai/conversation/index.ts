/**
 * Multi-Agent Conversation System
 * 
 * Main entry point for the conversation system
 * All user messages go to Master Agent first, which routes to appropriate agents
 */

import OpenAI from 'openai';
import { routeMessage } from './router';
import { executePersonaExtractionAgent } from './agents/personaExtractionAgent';
import { updateUserPersona } from './tools/userTools';
import { logger } from '../../utils/logging';

let openaiClientInstance: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required. Please set it in your .env file.');
    }
    openaiClientInstance = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openaiClientInstance;
}

/**
 * Process a user message through the agent system
 * 
 * @param userId - The user ID (contact number)
 * @param message - The user's message
 * @returns The agent's response string (caller is responsible for sending to user)
 */
export async function processMessage(
  userId: number,
  message: string
): Promise<string> {
  logger.info('processMessage: Starting', {
    userId,
    messagePreview: message.substring(0, 100),
  });

  try {
    const client = getOpenAIClient();
    
    const response = await routeMessage(userId, message, {
      primarySDK: 'openai',
      fallbackSDK: 'xai', // Placeholder for future xAI implementation
      openaiClient: client,
    });

    logger.info('processMessage: Completed', {
      userId,
      responsePreview: response.substring(0, 100),
    });

    return response;
  } catch (error) {
    logger.error('processMessage: Failed', error instanceof Error ? error : new Error(String(error)), {
      userId,
    });
    throw error;
  }
}

/**
 * Extract user persona from conversation history
 * 
 * @param userId - The user ID
 * @returns The extracted persona
 */
export async function extractPersona(userId: number): Promise<any> {
  logger.info('extractPersona: Starting', {
    userId,
  });

  try {
    const client = getOpenAIClient();
    
    const result = await executePersonaExtractionAgent(client, userId);

    // Update user persona in database
    await updateUserPersona(userId, result.persona);

    logger.info('extractPersona: Completed', {
      userId,
      personaKeys: Object.keys(result.persona),
    });

    return result;
  } catch (error) {
    logger.error('extractPersona: Failed', error instanceof Error ? error : new Error(String(error)), {
      userId,
    });
    throw error;
  }
}

// Export agent functions for direct access if needed
export { executeMasterAgent } from './agents/masterAgent';
export { executeOnboardingAgent } from './agents/onboardingAgent';
export { executePlanningAgent } from './agents/planningAgent';
export { executeOutOfScopeAgent } from './agents/outOfScopeAgent';
export { executePersonaExtractionAgent } from './agents/personaExtractionAgent';
