/**
 * Multi-Agent Conversation System
 * 
 * Main entry point for the conversation system
 * All user messages go to Master Agent first, which routes to appropriate agents
 */

import OpenAI from 'openai';
import { routeMessage } from './router';
import { logger } from '../../utils/logging';
import { User } from '../../../types/database';

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
 * @param user - The user object (fetched once at entry point)
 * @param message - The user's message
 * @returns The agent's response string (caller is responsible for sending to user)
 */
export async function processMessage(
  user: User,
  message: string
): Promise<string> {
  logger.info('Process Message: Entry', {
    operation: 'processMessage',
    userId: user.user_id,
    messageLength: message.length,
    messagePreview: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
  });

  try {
    logger.info('Process Message: Getting OpenAI client', {
      operation: 'processMessage',
      userId: user.user_id,
      hasClientInstance: !!openaiClientInstance,
    });
    
    const client = getOpenAIClient();
    
    logger.info('Process Message: Routing message', {
      operation: 'processMessage',
      userId: user.user_id,
      primarySDK: 'openai',
      fallbackSDK: 'xai',
    });
    
    const response = await routeMessage(user, message, {
      primarySDK: 'openai',
      fallbackSDK: 'xai', // Placeholder for future xAI implementation
      openaiClient: client,
    });

    logger.info('Process Message: Exit (Success)', {
      operation: 'processMessage',
      userId: user.user_id,
      responseLength: response.length,
      responsePreview: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
    });

    return response;
  } catch (error) {
    logger.error('Process Message: Exit (Error)', error instanceof Error ? error : new Error(String(error)), {
      operation: 'processMessage',
      userId: user.user_id,
      messageLength: message.length,
    });
    throw error;
  }
}


// Export agent functions for direct access if needed
export { executeMasterAgent } from './agents/masterAgent';
export { executeOnboardingAgent } from './agents/onboardingAgent';
