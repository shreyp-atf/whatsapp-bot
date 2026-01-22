/**
 * Out of Scope Agent
 * 
 * Handles off-topic conversations, politely redirects to "going out" theme
 */

import OpenAI from 'openai';
import { executeAgentWithTools } from '../utils/baseAgentExecutor';
import { loadAgentPrompt } from '../utils/promptLoader';
import { logger } from '../../../utils/logging';
import { OutOfScopeAgentOutput } from '../schemas/outOfScopeAgent.output';

/**
 * Execute Out of Scope Agent
 */
export async function executeOutOfScopeAgent(
  client: OpenAI,
  userId: number,
  message: string
): Promise<OutOfScopeAgentOutput> {
  logger.info('Out of Scope Agent: Processing message', {
    agent: 'out-of-scope',
    userId,
    messagePreview: message.substring(0, 100),
  });

  const agentPrompt = loadAgentPrompt('outOfScopeAgent');

  try {
    const result = await executeAgentWithTools<string>(
      client,
      {
        model: 'gpt-4o',
        temperature: 0.7,
        agentName: 'out-of-scope',
        agentPrompt: agentPrompt,
        userId,
        message: message,
        addAgentContext: true, // Add agent context when routing to this agent
      }
    );

    logger.info('Out of Scope Agent: Completed processing', {
      agent: 'out-of-scope',
      userId,
    });

    return {
      response: result,
    };
  } catch (error) {
    logger.error('Out of Scope Agent: Execution failed', error instanceof Error ? error : new Error(String(error)), {
      agent: 'out-of-scope',
      userId,
    });
    throw error;
  }
}
