/**
 * Onboarding Agent
 * 
 * Collects user information through conversational onboarding process
 * Reads onboardingQuestions.json and builds user persona
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { executeAgentWithTools } from '../utils/baseAgentExecutor';
import { loadAgentPrompt, loadOnboardingQuestions } from '../utils/promptLoader';
// Note: Onboarding Agent uses its own conversation from agent_conversation_ids
// Conversation history is accessed through its own conversation, not Master Agent's
import { OnboardingAgentOutput } from '../schemas/onboardingAgent.output';
import { logger } from '../../../utils/logging';
import { User } from '../../../../types/database';
import { getUserById } from '../../../../db/user';

/**
 * First message greeting prefix
 */
const FIRST_MESSAGE_GREETING = "Hi! I'm Shrey. I love making plans that people actually show up to!\n\nBefore we get started, I need some basic details.";

/**
 * Zod schema for Onboarding Agent output
 */
const onboardingOutputSchema = z.object({
  response: z.string().describe('The message to send to the user'),
  onboardingComplete: z.boolean().describe('Whether onboarding is complete'),
  userUpdates: z.object({
    name: z.string().optional(),
    bio: z.string().optional(),
    locality_id: z.number().optional(),
  }).optional().describe('User information updates'),
  persona: z.object({
    age: z.union([z.string(), z.number()]).optional(),
    gender: z.string().optional(),
    planning_behavior: z.union([z.string(), z.array(z.string())]).optional(),
    social_behavior: z.union([z.string(), z.array(z.string())]).optional(),
    preferences: z.union([z.string(), z.array(z.string())]).optional(),
  }).passthrough().optional().describe('User persona data'),
}).passthrough();

/**
 * Execute Onboarding Agent
 * 
 * @param client - OpenAI client
 * @param userId - User ID
 * @param message - User message
 * @param longTermMemory - Long-term memory (persona) passed from Master Agent
 * @param shortTermMemory - Short-term memory passed from Master Agent
 * @param user - Optional user object (if provided, avoids database fetch)
 * @returns Onboarding Agent output with response and persona
 */
export async function executeOnboardingAgent(
  client: OpenAI,
  userId: number,
  message: string,
  longTermMemory?: any,
  shortTermMemory?: any,
  user?: User
): Promise<OnboardingAgentOutput> {
  // Log sub-agent execution start
  logger.info('Sub-Agent Execution Start (Onboarding)', {
    agent: 'onboarding',
    userId,
    message: message.substring(0, 500) + (message.length > 500 ? '...' : ''),
    messageLength: message.length,
    hasLongTermMemory: !!longTermMemory,
    hasShortTermMemory: !!shortTermMemory,
  });

  try {
    // Load onboarding prompt and questions
    const agentPrompt = loadAgentPrompt('onboardingAgent');
    const onboardingQuestions = loadOnboardingQuestions();

    // Build memory context to include in system message
    const memoryContext = longTermMemory || shortTermMemory
      ? `

MEMORY CONTEXT (from Master Agent):
${longTermMemory ? `LONG TERM MEMORY (User Persona):\n${JSON.stringify(longTermMemory, null, 2)}\n` : ''}
${shortTermMemory ? `SHORT TERM MEMORY (Current State):\n${JSON.stringify(shortTermMemory, null, 2)}\n` : ''}`
      : '';

    // Build enhanced prompt with questions and memory
    // CRITICAL: Put JSON requirement FIRST and make it very prominent
    const enhancedPrompt = `⚠️ CRITICAL OUTPUT FORMAT REQUIREMENT ⚠️

YOU MUST ALWAYS RETURN YOUR RESPONSE AS A VALID JSON OBJECT. NEVER RETURN PLAIN TEXT.

Your response MUST be in this exact JSON format:
{
  "response": "Your message text here",
  "onboardingComplete": false,
  "userUpdates": { "name": "...", "locality_id": ... },
  "persona": { "age": "...", "gender": "...", ... }
}

Example valid response:
{
  "response": "What's your name?",
  "onboardingComplete": false,
  "userUpdates": {},
  "persona": {}
}

DO NOT return plain text like "What's your name?" - it MUST be wrapped in JSON.
DO NOT use markdown formatting in the response field - just plain text.
DO NOT return markdown like **Question 1:** - put it in the response field as plain text.

${agentPrompt}
${memoryContext}
ONBOARDING QUESTIONS:
${JSON.stringify(onboardingQuestions, null, 2)}

Use these questions as a guide. Track which questions have been answered by reviewing YOUR OWN conversation history (not Master Agent's).
When all essential questions are answered, set onboardingComplete to true and include the complete persona object.

REMEMBER: Your ENTIRE response must be valid JSON, starting with { and ending with }.`;

    // Execute agent with restricted tools (sub-agent, no response capabilities)
    // Agent name 'onboarding' will be used to store conversation in agent_conversation_ids
    const result = await executeAgentWithTools<OnboardingAgentOutput>(
      client,
      {
        agentName: 'onboarding',
        agentPrompt: enhancedPrompt, // This will be used as system message
        userId,
        message,
        createUserIfNotExists: true, // Onboarding agent can create users
        outputSchema: onboardingOutputSchema,
        isSubAgent: true, // Use restricted tools - cannot send responses, uses agent_conversation_ids
        user, // Pass user object to avoid redundant fetch
      }
    );

    // Check if this is the first message by examining the onboarding agent's conversation history
    // The onboarding agent uses its own conversation stored in agent_conversation_ids['onboarding']
    let isFirstMessage = false;
    const userData = user || await getUserById(userId);
    
    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboardingAgent.ts:139',message:'Checking if first message',data:{userId,hasUser:!!userData,hasAgentConversationIds:!!userData?.agent_conversation_ids},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (userData?.agent_conversation_ids?.onboarding) {
      try {
        // Get conversation items from onboarding agent's conversation
        const items = await client.conversations.items.list(userData.agent_conversation_ids.onboarding, {
          limit: 100,
          order: 'asc',
        });
        
        let userMessageCount = 0;
        for await (const item of items) {
          if (item.type === 'message' && 'role' in item && (item as any).role === 'user') {
            userMessageCount++;
          }
        }
        
        // #region agent log
        fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboardingAgent.ts:155',message:'Conversation history checked',data:{userId,userMessageCount,isFirstMessage:userMessageCount === 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // If there are no user messages yet (or only the current one being added), it's the first message
        // Note: The current message hasn't been added yet, so count of 0 means first message
        isFirstMessage = userMessageCount === 0;
      } catch (error) {
        logger.warn('Onboarding Agent: Error checking conversation history for first message', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fallback: check if greeting is in response (less reliable but better than nothing)
        isFirstMessage = !result.response.includes("Hi! I'm Shrey");
      }
    } else {
      // No conversation exists yet, so this is definitely the first message
      isFirstMessage = true;
      
      // #region agent log
      fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboardingAgent.ts:170',message:'No conversation exists, treating as first message',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }

    // Add greeting prefix only if this is truly the first message
    let finalResponse = result.response;
    if (isFirstMessage && !finalResponse.includes("Hi! I'm Shrey")) {
      finalResponse = `${FIRST_MESSAGE_GREETING}\n\n${finalResponse}`;
      
      // #region agent log
      fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboardingAgent.ts:177',message:'Added first message greeting prefix',data:{userId,isFirstMessage,responseLength:finalResponse.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      logger.info('Onboarding Agent: Added first message greeting prefix', {
        userId,
      });
    } else {
      // #region agent log
      fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboardingAgent.ts:185',message:'Not adding greeting prefix',data:{userId,isFirstMessage,hasGreetingInResponse:finalResponse.includes("Hi! I'm Shrey")},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }

    // Log sub-agent execution completion
    logger.info('Sub-Agent Execution Complete (Onboarding)', {
      agent: 'onboarding',
      userId,
      onboardingComplete: result.onboardingComplete,
      hasPersona: !!result.persona,
      personaKeys: result.persona ? Object.keys(result.persona) : [],
      responseLength: finalResponse.length,
      response: finalResponse.substring(0, 500) + (finalResponse.length > 500 ? '...' : ''),
      greetingAdded: finalResponse.includes("Hi! I'm Shrey"),
    });

    return {
      ...result,
      response: finalResponse,
    };
  } catch (error) {
    logger.error('Onboarding Agent: Execution failed', error instanceof Error ? error : new Error(String(error)), {
      userId,
    });
    throw error;
  }
}
