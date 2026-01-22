/**
 * Onboarding Agent
 * 
 * Handles new user onboarding, tracks progress through conversation history
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { executeAgentWithTools } from '../utils/baseAgentExecutor';
import { loadAgentPrompt, loadOnboardingQuestions } from '../utils/promptLoader';
import { logger } from '../../../utils/logging';
import { getConversationHistory } from '../tools/userTools';
import { OnboardingAgentOutput } from '../schemas/onboardingAgent.output';

const OnboardingAgentOutputSchema = z.object({
  response: z.string(),
  onboardingComplete: z.boolean(),
  userUpdates: z.object({
    name: z.string().optional(),
    bio: z.string().optional(),
    locality_id: z.number().optional(),
  }).optional(),
});

/**
 * Execute Onboarding Agent
 */
export async function executeOnboardingAgent(
  client: OpenAI,
  userId: number,
  message: string
): Promise<OnboardingAgentOutput> {
  logger.info('Onboarding Agent: Processing message', {
    agent: 'onboarding',
    userId,
    messagePreview: message.substring(0, 100),
  });

  const agentPrompt = loadAgentPrompt('onboardingAgent');
  const questions = loadOnboardingQuestions();

  // Get conversation history to track progress
  let conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  try {
    conversationHistory = await getConversationHistory(userId, client);
  } catch (error) {
    logger.warn('Onboarding Agent: Failed to get conversation history', {
      agent: 'onboarding',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Build prompt with onboarding context
  const historyContext = conversationHistory.length > 0
    ? `\n\nConversation History (for tracking progress):\n${conversationHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}`
    : '\n\nThis is the start of the conversation.';

  const questionsContext = `\n\nAvailable onboarding questions:\n${JSON.stringify(questions, null, 2)}`;

  const jsonOutputInstruction = `\n\nIMPORTANT: You must respond with a valid JSON object in this exact format:
{
  "response": "your response message here",
  "onboardingComplete": true or false,
  "userUpdates": {
    "name": "optional name",
    "bio": "optional bio",
    "locality_id": optional_number
  }
}`;

  const fullPrompt = `${agentPrompt}${historyContext}${questionsContext}${jsonOutputInstruction}\n\nUser message: ${message}`;

  try {
    const result = await executeAgentWithTools<OnboardingAgentOutput>(
      client,
      {
        model: 'gpt-4o',
        temperature: 0.7,
        agentName: 'onboarding',
        agentPrompt: agentPrompt,
        userId,
        message: fullPrompt,
        addAgentContext: true, // Add agent context when routing to this agent
        outputSchema: OnboardingAgentOutputSchema,
        createUserIfNotExists: true, // Onboarding agent can create user if needed
      }
    );

    logger.info('Onboarding Agent: Completed processing', {
      agent: 'onboarding',
      userId,
      onboardingComplete: result.onboardingComplete,
    });

    return result;
  } catch (error) {
    logger.error('Onboarding Agent: Execution failed', error instanceof Error ? error : new Error(String(error)), {
      agent: 'onboarding',
      userId,
    });
    throw error;
  }
}
