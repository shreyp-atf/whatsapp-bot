/**
 * Master Agent Tools
 * 
 * Tools for Master Agent to invoke sub-agents (Onboarding, Planning, Summary)
 */

import OpenAI from 'openai';
import { executeOnboardingAgent } from '../agents/onboardingAgent';
import { OnboardingAgentOutput } from '../schemas/onboardingAgent.output';
import { logger } from '../../../utils/logging';
import { User } from '../../../../types/database';

/**
 * Invoke Onboarding Agent
 * Reads onboardingQuestions.json and builds user persona
 * Receives memory objects from Master Agent (not conversation history)
 */
export async function invokeOnboardingAgent(
  userId: number,
  message: string,
  client: OpenAI,
  longTermMemory?: any,
  shortTermMemory?: any,
  user?: User
): Promise<OnboardingAgentOutput> {
  // Log sub-agent input
  logger.info('Sub-Agent Input (Onboarding)', {
    agent: 'onboarding',
    userId,
    message: message.substring(0, 500) + (message.length > 500 ? '...' : ''),
    messageLength: message.length,
    invokedBy: 'master',
    hasLongTermMemory: !!longTermMemory,
    hasShortTermMemory: !!shortTermMemory,
  });

  try {
    const result = await executeOnboardingAgent(client, userId, message, longTermMemory, shortTermMemory, user);
    
    // Log sub-agent output
    logger.info('Sub-Agent Output (Onboarding)', {
      agent: 'onboarding',
      userId,
      response: result.response?.substring(0, 500) + (result.response && result.response.length > 500 ? '...' : ''),
      responseLength: result.response?.length || 0,
      onboardingComplete: result.onboardingComplete,
      hasPersona: !!result.persona,
      personaKeys: result.persona ? Object.keys(result.persona) : [],
      hasUserUpdates: !!result.userUpdates,
      userUpdateKeys: result.userUpdates ? Object.keys(result.userUpdates) : [],
    });
    
    return result;
  } catch (error) {
    logger.error('Master Agent: Onboarding Agent failed', error instanceof Error ? error : new Error(String(error)), {
      userId,
    });
    throw error;
  }
}

/**
 * Invoke Planning Agent
 * To be implemented later
 */
export async function invokePlanningAgent(
  userId: number,
  message: string,
  client: OpenAI,
  longTermMemory?: any,
  shortTermMemory?: any,
  user?: User
): Promise<{ response: string; [key: string]: any }> {
  // Log sub-agent input
  logger.info('Sub-Agent Input (Planning)', {
    agent: 'planning',
    userId,
    message: message.substring(0, 500) + (message.length > 500 ? '...' : ''),
    messageLength: message.length,
    invokedBy: 'master',
    hasLongTermMemory: !!longTermMemory,
    hasShortTermMemory: !!shortTermMemory,
  });

  // TODO: Implement Planning Agent
  const result = {
    response: 'Planning Agent is not yet implemented.',
  };
  
  // Log sub-agent output
  logger.info('Sub-Agent Output (Planning)', {
    agent: 'planning',
    userId,
    response: result.response,
    responseLength: result.response.length,
  });
  
  return result;
}

/**
 * Invoke Summary Agent
 * To be implemented later
 */
export async function invokeSummaryAgent(
  userId: number,
  message: string,
  client: OpenAI,
  longTermMemory?: any,
  shortTermMemory?: any,
  user?: User
): Promise<{ response: string; [key: string]: any }> {
  // Log sub-agent input
  logger.info('Sub-Agent Input (Summary)', {
    agent: 'summary',
    userId,
    message: message.substring(0, 500) + (message.length > 500 ? '...' : ''),
    messageLength: message.length,
    invokedBy: 'master',
    hasLongTermMemory: !!longTermMemory,
    hasShortTermMemory: !!shortTermMemory,
  });

  // TODO: Implement Summary Agent
  const result = {
    response: 'Summary Agent is not yet implemented.',
  };
  
  // Log sub-agent output
  logger.info('Sub-Agent Output (Summary)', {
    agent: 'summary',
    userId,
    response: result.response,
    responseLength: result.response.length,
  });
  
  return result;
}

/**
 * Get OpenAI function tool definitions for Master Agent tools
 */
export function getMasterAgentTools(): OpenAI.Responses.FunctionTool[] {
  return [
    {
      type: 'function' as const,
      name: 'invoke_onboarding_agent',
      description: 'Invoke the Onboarding Agent to collect user information and build persona. Use this when user needs onboarding or persona is incomplete.',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
          message: {
            type: 'string',
            description: 'The user message to process',
          },
        },
        required: ['user_id', 'message'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'invoke_planning_agent',
      description: 'Invoke the Planning Agent to help with planning activities and events. Use this when user wants to plan something or discuss going out.',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
          message: {
            type: 'string',
            description: 'The user message to process',
          },
        },
        required: ['user_id', 'message'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'invoke_summary_agent',
      description: 'Invoke the Summary Agent to summarize conversations or plans. Use this when user requests a summary.',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
          message: {
            type: 'string',
            description: 'The user message to process',
          },
        },
        required: ['user_id', 'message'],
        additionalProperties: false,
      },
      strict: true,
    },
  ];
}

/**
 * Execute a Master Agent tool by name
 * Passes memory objects to sub-agents
 */
export async function executeMasterAgentTool(
  toolName: string,
  args: any,
  userId: number,
  client: OpenAI,
  longTermMemory?: any,
  shortTermMemory?: any,
  user?: User
): Promise<any> {
  switch (toolName) {
    case 'invoke_onboarding_agent':
      return await invokeOnboardingAgent(userId, args.message, client, longTermMemory, shortTermMemory, user);
    
    case 'invoke_planning_agent':
      return await invokePlanningAgent(userId, args.message, client, longTermMemory, shortTermMemory, user);
    
    case 'invoke_summary_agent':
      return await invokeSummaryAgent(userId, args.message, client, longTermMemory, shortTermMemory, user);
    
    default:
      throw new Error(`Unknown Master Agent tool: ${toolName}`);
  }
}
