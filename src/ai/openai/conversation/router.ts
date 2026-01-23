/**
 * Conversation Router
 * 
 * Simplified router that delegates all routing to Master Agent.
 * Master Agent handles sub-agent invocation internally via tools.
 */

import OpenAI from 'openai';
import { executeMasterAgent } from './agents/masterAgent';
import { loadErrorFallback } from './utils/promptLoader';
import { logger } from '../../utils/logging';
import { User } from '../../../types/database';

/**
 * Router configuration
 */
interface RouterConfig {
  primarySDK: 'openai' | 'xai';
  fallbackSDK: 'openai' | 'xai';
  openaiClient?: OpenAI;
  // xaiClient would go here if needed
}

/**
 * Route a message through the agent system
 * 
 * All routing is handled by Master Agent internally.
 * Master Agent decides whether to handle directly or invoke sub-agents via tools.
 */
export async function routeMessage(
  user: User,
  message: string,
  config: RouterConfig
): Promise<string> {
  logger.info('Router: routeMessage - Entry', {
    operation: 'routeMessage',
    userId: user.user_id,
    messageLength: message.length,
    messagePreview: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
    primarySDK: config.primarySDK,
    fallbackSDK: config.fallbackSDK,
    hasOpenAIClient: !!config.openaiClient,
  });

  const { primarySDK, fallbackSDK, openaiClient } = config;

  if (!openaiClient) {
    logger.error('Router: routeMessage - No OpenAI client', new Error('OpenAI client is required'), {
      operation: 'routeMessage',
      userId: user.user_id,
    });
    throw new Error('OpenAI client is required');
  }

  try {
    logger.info('Router: routeMessage - Calling Master Agent', {
      operation: 'routeMessage',
      userId: user.user_id,
      primarySDK,
    });
    
    // Master Agent handles all routing internally
    const response = await executeMasterAgent(openaiClient, user, message);
    
    logger.info('Router: routeMessage - Exit (Success)', {
      operation: 'routeMessage',
      userId: user.user_id,
      responseLength: response.length,
      responsePreview: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
    });
    
    return response;
  } catch (primaryError) {
    logger.error('Router: routeMessage - Primary SDK failed', primaryError instanceof Error ? primaryError : new Error(String(primaryError)), {
      operation: 'routeMessage',
      userId: user.user_id,
      primarySDK,
      fallbackSDK,
    });

    // Try fallback SDK (for now, we only have OpenAI implemented)
    // In the future, this would try xAI if primary was OpenAI
    try {
      logger.info('Router: routeMessage - Attempting fallback SDK', {
        operation: 'routeMessage',
        userId: user.user_id,
        fallbackSDK,
      });
      
      // For now, if OpenAI fails, we can't fallback to xAI yet
      // This is a placeholder for future implementation
      throw new Error('Fallback SDK not yet implemented');
    } catch (fallbackError) {
      logger.error('Router: routeMessage - Both SDKs failed', fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)), {
        operation: 'routeMessage',
        userId: user.user_id,
        primarySDK,
        fallbackSDK,
      });

      // Both SDKs failed, return fallback message
      const fallbackMessage = loadErrorFallback();
      
      logger.info('Router: routeMessage - Exit (Fallback)', {
        operation: 'routeMessage',
        userId: user.user_id,
        fallbackMessageLength: fallbackMessage.length,
      });
      
      return fallbackMessage;
    }
  }
}
