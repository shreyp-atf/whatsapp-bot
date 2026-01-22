/**
 * Persona Extraction Agent
 * 
 * Summarizes conversations and extracts user persona
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { executeAgentWithTools } from '../utils/baseAgentExecutor';
import { loadAgentPrompt } from '../utils/promptLoader';
import { logger } from '../../../utils/logging';
import { getConversationHistory } from '../tools/userTools';
import { PersonaExtractionAgentOutput } from '../schemas/personaExtractionAgent.output';

const PersonaExtractionAgentOutputSchema = z.object({
  persona: z.object({
    preferences: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    communication_style: z.string().optional(),
    behavior_patterns: z.array(z.string()).optional(),
    location_preferences: z.array(z.string()).optional(),
    activity_preferences: z.array(z.string()).optional(),
  }),
  summary: z.string(),
});

/**
 * Execute Persona Extraction Agent
 */
export async function executePersonaExtractionAgent(
  client: OpenAI,
  userId: number
): Promise<PersonaExtractionAgentOutput> {
  logger.info('Persona Extraction Agent: Starting extraction', {
    agent: 'persona-extraction',
    userId,
  });

  const agentPrompt = loadAgentPrompt('personaExtractionAgent');

  // Get full conversation history
  const conversationHistory = await getConversationHistory(userId, client);

  if (conversationHistory.length === 0) {
    logger.warn('Persona Extraction Agent: No conversation history found', {
      agent: 'persona-extraction',
      userId,
    });
    return {
      persona: {},
      summary: 'No conversation history available.',
    };
  }

  // Format conversation history for the agent
  const historyText = conversationHistory
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const jsonOutputInstruction = `\n\nIMPORTANT: You must respond with a valid JSON object in this exact format:
{
  "persona": {
    "preferences": ["preference1", "preference2"],
    "interests": ["interest1", "interest2"],
    "communication_style": "description",
    "behavior_patterns": ["pattern1", "pattern2"],
    "location_preferences": ["location1"],
    "activity_preferences": ["activity1"]
  },
  "summary": "conversation summary here"
}`;

  const fullPrompt = `${agentPrompt}${jsonOutputInstruction}\n\nConversation History:\n${historyText}`;

  try {
    const result = await executeAgentWithTools<PersonaExtractionAgentOutput>(
      client,
      {
        model: 'gpt-4o',
        temperature: 0.7,
        agentName: 'persona-extraction',
        agentPrompt: agentPrompt,
        userId,
        message: fullPrompt,
        addAgentContext: false,
        outputSchema: PersonaExtractionAgentOutputSchema,
      }
    );

    logger.info('Persona Extraction Agent: Completed extraction', {
      agent: 'persona-extraction',
      userId,
      personaKeys: Object.keys(result.persona),
    });

    return result;
  } catch (error) {
    logger.error('Persona Extraction Agent: Execution failed', error instanceof Error ? error : new Error(String(error)), {
      agent: 'persona-extraction',
      userId,
    });
    throw error;
  }
}
