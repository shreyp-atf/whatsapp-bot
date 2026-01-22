/**
 * Planning Agent
 * 
 * Handles "going out" planning conversations
 */

import OpenAI from 'openai';
import { executeAgentWithTools } from '../utils/baseAgentExecutor';
import { loadAgentPrompt } from '../utils/promptLoader';
import { logger } from '../../../utils/logging';
import { PlanningAgentOutput } from '../schemas/planningAgent.output';

/**
 * Execute Planning Agent
 */
export async function executePlanningAgent(
  client: OpenAI,
  userId: number,
  message: string
): Promise<PlanningAgentOutput> {
  logger.info('Planning Agent: Processing message', {
    agent: 'planning',
    userId,
    messagePreview: message.substring(0, 100),
  });

  const agentPrompt = loadAgentPrompt('planningAgent');

  try {
    const result = await executeAgentWithTools<string>(
      client,
      {
        model: 'gpt-4o',
        temperature: 0.7,
        agentName: 'planning',
        agentPrompt: agentPrompt,
        userId,
        message: message,
        addAgentContext: true, // Add agent context when routing to this agent
      }
    );

    logger.info('Planning Agent: Completed processing', {
      agent: 'planning',
      userId,
    });

    return {
      response: result,
    };
  } catch (error) {
    logger.error('Planning Agent: Execution failed', error instanceof Error ? error : new Error(String(error)), {
      agent: 'planning',
      userId,
    });
    throw error;
  }
}
