/**
 * Master Agent
 * 
 * Always receives user messages first and determines which agent should respond
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { executeAgentWithTools } from '../utils/baseAgentExecutor';
import { loadAgentPrompt } from '../utils/promptLoader';
import { logger } from '../../../utils/logging';
import { MasterAgentOutput } from '../schemas/masterAgent.output';

const MasterAgentOutputSchema = z.object({
  response: z.string(),
  targetAgent: z.enum(['onboarding', 'planning', 'out-of-scope', 'master']).nullable(),
  routingDepth: z.number(),
  reasoning: z.string().optional(),
});

/**
 * Execute Master Agent
 */
export async function executeMasterAgent(
  client: OpenAI,
  userId: number,
  message: string,
  routingDepth: number = 0
): Promise<MasterAgentOutput> {
  logger.info('Master Agent: Processing message', {
    agent: 'master',
    userId,
    routingDepth,
    messagePreview: message.substring(0, 100),
  });

  const agentPrompt = loadAgentPrompt('masterAgent');
  
  // Build the prompt with routing depth context and JSON output instruction
  const jsonOutputInstruction = `\n\nIMPORTANT: You must respond with a valid JSON object in this exact format:
{
  "response": "your response message here (can be empty if routing)",
  "targetAgent": "onboarding" | "planning" | "out-of-scope" | "master" | null,
  "routingDepth": ${routingDepth + 1} (increment by 1 if routing to another agent, keep ${routingDepth} if handling yourself),
  "reasoning": "brief explanation of routing decision"
}`;

  const fullPrompt = `${agentPrompt}${jsonOutputInstruction}\n\nCurrent routing depth: ${routingDepth}\nMaximum routing depth: 2\nIf routing depth would exceed 2, handle the message yourself instead.\n\nUser message: ${message}`;

  try {
    const result = await executeAgentWithTools<MasterAgentOutput>(
      client,
      {
        model: 'gpt-4o',
        temperature: 0.7,
        agentName: 'master',
        agentPrompt: agentPrompt,
        userId,
        message: fullPrompt,
        addAgentContext: false, // Master Agent doesn't need context added
        outputSchema: MasterAgentOutputSchema,
        allowMissingUser: true, // Master Agent can handle missing users
      }
    );

    logger.info('Master Agent: Completed processing', {
      agent: 'master',
      userId,
      targetAgent: result.targetAgent,
      routingDepth: result.routingDepth,
    });

    return result;
  } catch (error) {
    logger.error('Master Agent: Execution failed', error instanceof Error ? error : new Error(String(error)), {
      agent: 'master',
      userId,
    });
    throw error;
  }
}
