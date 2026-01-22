/**
 * Conversation Router
 * 
 * Routes user messages to Master Agent first, then to appropriate target agents
 * Implements SDK fallback and routing depth tracking
 */

import OpenAI from 'openai';
import { executeMasterAgent } from './agents/masterAgent';
import { executeOnboardingAgent } from './agents/onboardingAgent';
import { executePlanningAgent } from './agents/planningAgent';
import { executeOutOfScopeAgent } from './agents/outOfScopeAgent';
import { loadErrorFallback } from './utils/promptLoader';
import { logger } from '../../utils/logging';

const MAX_ROUTING_DEPTH = 2;

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
 */
export async function routeMessage(
  userId: number,
  message: string,
  config: RouterConfig
): Promise<string> {
  logger.info('Router: Processing message', {
    userId,
    messagePreview: message.substring(0, 100),
  });

  const { primarySDK, fallbackSDK, openaiClient } = config;

  if (!openaiClient) {
    throw new Error('OpenAI client is required');
  }

  try {
    return await routeMessageWithSDK(userId, message, openaiClient, 0);
  } catch (primaryError) {
    logger.error('Router: Primary SDK failed, trying fallback', primaryError instanceof Error ? primaryError : new Error(String(primaryError)), {
      userId,
      primarySDK,
      fallbackSDK,
    });

    // Try fallback SDK (for now, we only have OpenAI implemented)
    // In the future, this would try xAI if primary was OpenAI
    try {
      // For now, if OpenAI fails, we can't fallback to xAI yet
      // This is a placeholder for future implementation
      throw new Error('Fallback SDK not yet implemented');
    } catch (fallbackError) {
      logger.error('Router: Both SDKs failed, returning fallback message', fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)), {
        userId,
      });

      // Both SDKs failed, return fallback message
      return loadErrorFallback();
    }
  }
}

/**
 * Route message with a specific SDK
 */
async function routeMessageWithSDK(
  userId: number,
  message: string,
  client: OpenAI,
  routingDepth: number
): Promise<string> {
  logger.info('Router: Routing to Master Agent', {
    userId,
    routingDepth,
  });

  // Always start with Master Agent
  const masterResult = await executeMasterAgent(client, userId, message, routingDepth);

  logger.info('Router: Master Agent routing decision', {
    userId,
    targetAgent: masterResult.targetAgent,
    routingDepth: masterResult.routingDepth,
    reasoning: masterResult.reasoning,
  });

  // Check if Master Agent wants to handle the message itself
  if (masterResult.targetAgent === null || masterResult.targetAgent === 'master') {
    logger.info('Router: Master Agent handling message', {
      userId,
    });
    return masterResult.response || 'I apologize, but I could not generate a response.';
  }

  // Check routing depth (Master Agent returns depth after routing, so check if it exceeds max)
  if (masterResult.routingDepth > MAX_ROUTING_DEPTH) {
    logger.warn('Router: Routing depth exceeded, Master Agent handling', {
      userId,
      routingDepth: masterResult.routingDepth,
      maxDepth: MAX_ROUTING_DEPTH,
    });
    return masterResult.response || 'I apologize, but I could not generate a response.';
  }

  // Route to target agent
  const targetAgent = masterResult.targetAgent;
  logger.info('Router: Routing to target agent', {
    userId,
    targetAgent,
    routingDepth: masterResult.routingDepth,
  });

  let targetResponse: string;

  try {
    switch (targetAgent) {
      case 'onboarding':
        const onboardingResult = await executeOnboardingAgent(client, userId, message);
        targetResponse = onboardingResult.response;
        
        // Update user if onboarding provided updates
        if (onboardingResult.userUpdates) {
          // This would be handled by the onboarding agent's tools
          logger.info('Router: Onboarding agent provided user updates', {
            userId,
            updates: Object.keys(onboardingResult.userUpdates),
          });
        }
        break;

      case 'planning':
        const planningResult = await executePlanningAgent(client, userId, message);
        targetResponse = planningResult.response;
        break;

      case 'out-of-scope':
        const outOfScopeResult = await executeOutOfScopeAgent(client, userId, message);
        targetResponse = outOfScopeResult.response;
        break;

      default:
        logger.warn('Router: Unknown target agent, using Master Agent response', {
          userId,
          targetAgent,
        });
        targetResponse = masterResult.response || 'I apologize, but I could not generate a response.';
    }

    logger.info('Router: Completed processing', {
      userId,
      targetAgent,
      responsePreview: targetResponse.substring(0, 100),
    });

    return targetResponse;
  } catch (error) {
    logger.error('Router: Target agent execution failed', error instanceof Error ? error : new Error(String(error)), {
      userId,
      targetAgent,
    });
    
    // Fallback to Master Agent response if available
    if (masterResult.response) {
      return masterResult.response;
    }
    
    throw error;
  }
}
