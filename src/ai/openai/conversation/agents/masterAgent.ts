/**
 * Master Agent
 * 
 * The central orchestrator that:
 * - Handles all user conversations directly
 * - Manages Long Term Memory (persona) and Short Term Memory (conversation state)
 * - Routes to specialized agents via tool calls
 * - Updates memory after each interaction
 */

import OpenAI from 'openai';
import { executeAgentWithTools } from '../utils/baseAgentExecutor';
import { loadAgentPrompt } from '../utils/promptLoader';
import { getOpenAITools, executeTool } from '../tools/userTools';
import { getMasterAgentTools, executeMasterAgentTool } from '../tools/masterAgentTools';
import { getLongTermMemory, getShortTermMemory, updateLongTermMemory, mergeShortTermMemory } from '../utils/memoryManager';
import { MasterAgentOutput } from '../schemas/masterAgent.output';
import { OnboardingAgentOutput } from '../schemas/onboardingAgent.output';
import { logger } from '../../../utils/logging';
import { User } from '../../../../types/database';

/**
 * Execute Master Agent
 * 
 * @param client - OpenAI client
 * @param user - User object (fetched once at entry point)
 * @param message - User message
 * @returns Response string to send to user
 */
export async function executeMasterAgent(
  client: OpenAI,
  user: User,
  message: string
): Promise<string> {
  const userId = user.user_id;
  
  logger.info('Master Agent: Starting execution', {
    userId,
    messagePreview: message.substring(0, 100),
  });

  try {
    // Check if this is a new user's first message
    const { getConversationHistory } = await import('../tools/userTools');
    const conversationHistory = await getConversationHistory(userId, client, user);
    
    // Check if this is the first user message (no previous user messages in history)
    // The current message will be added later, so we check if history is empty or only has system messages
    const userMessages = conversationHistory.filter(msg => msg.role === 'user');
    const isFirstMessage = userMessages.length === 0;
    
    // If this is the first message, we'll handle it specially
    if (isFirstMessage) {
      logger.info('Master Agent: First message detected', {
        userId,
      });
      
      // Update short-term memory to indicate onboarding started
      await mergeShortTermMemory(userId, {
        activeAgent: 'onboarding',
        conversationContext: {
          lastTopic: 'onboarding_started',
          firstMessage: true,
        },
      }, user);
    }

    // Get memory state
    const longTermMemory = await getLongTermMemory(userId, user);
    const shortTermMemory = await getShortTermMemory(userId, user);

    // Load Master Agent prompt
    const agentPrompt = loadAgentPrompt('masterAgent');

    // Build enhanced prompt with memory context
    const firstMessageNote = isFirstMessage 
      ? `\n\nCRITICAL: This is the user's FIRST MESSAGE. You MUST:
1. Start your response with EXACTLY this greeting: "Hi! I'm Shrey. I love making plans that people actually show up to!\n\nBefore we get started, I need some basic details."
2. Then immediately invoke the Onboarding Agent using invoke_onboarding_agent tool with the user's message.
3. The Onboarding Agent will handle the rest of the conversation.\n`
      : '';
    
    const memoryContext = `
CURRENT USER ID: ${userId}
CRITICAL: When calling tools that require user_id parameter, you MUST use ${userId} (the current user's ID). Never make up, guess, or use placeholder user IDs like 1234567890.

LONG TERM MEMORY (User Persona):
${longTermMemory ? JSON.stringify(longTermMemory, null, 2) : 'No persona data available. User needs onboarding.'}

SHORT TERM MEMORY (Current State):
${shortTermMemory ? JSON.stringify(shortTermMemory, null, 2) : 'No short-term memory available.'}
${firstMessageNote}
Your responsibilities:
1. Fetch user information using fetch_user tool (users are created programmatically when chats are created, so they always exist)
2. Get conversation history using get_conversation_history tool
3. Analyze the message and decide whether to:
   - Handle directly (respond yourself) ${isFirstMessage ? '- DO NOT do this for first message' : ''}
   - Invoke Onboarding Agent (if user needs onboarding or persona incomplete) ${isFirstMessage ? '- ALWAYS do this for first message' : ''}
   - Invoke Planning Agent (if user wants to plan activities)
   - Invoke Summary Agent (if user requests summary)
4. After processing, update short_term_memory_json with:
   - activeAgent: which agent is currently active (or null if you handled it)
   - conversationContext: current topic/intent
   - currentPlan: if a plan is being discussed
5. If Onboarding Agent completes (onboardingComplete: true), update persona_json with the persona data
`;

    const enhancedPrompt = `${agentPrompt}

${memoryContext}`;

    // Combine user tools and master agent tools
    // Master Agent has FULL tool access (not restricted like sub-agents)
    // Sub-agents use getSubAgentTools() which only allows read/update operations
    // Filter out create_user tool - users are created programmatically when chats are created
    const userTools = getOpenAITools().filter(tool => tool.name !== 'create_user');
    const allTools = [...userTools, ...getMasterAgentTools()];

    // Custom tool executor that handles both user tools and master agent tools
    // Passes memory objects to sub-agents
    const customExecuteTool = async (toolName: string, args: any): Promise<any> => {
      // Check if it's a master agent tool (sub-agent invocation)
      if (toolName.startsWith('invoke_')) {
        // Pass memory objects to sub-agents
        return await executeMasterAgentTool(toolName, args, userId, client, longTermMemory, shortTermMemory, user);
      }
      // Otherwise, it's a user tool
      return await executeTool(toolName, args, userId, client, user);
    };

    // Execute Master Agent with all tools
    // Pass enhancedPrompt (with memory context) as system message
    // We'll use a modified version that handles sub-agent invocations
    const response = await executeMasterAgentWithSubAgents(
      client,
      {
        agentName: 'master',
        agentPrompt: enhancedPrompt, // This will be used as system message
        userId,
        user,
        message,
        allowMissingUser: true, // Master Agent can handle missing users
        tools: allTools,
        customExecuteTool,
        isFirstMessage, // Pass flag to handle greeting
        longTermMemory, // Pass memory objects for sub-agents
        shortTermMemory,
      }
    );

    logger.info('Master Agent: Completed execution', {
      userId,
      responsePreview: response.substring(0, 100),
    });

    return response;
  } catch (error) {
    logger.error('Master Agent: Execution failed', error instanceof Error ? error : new Error(String(error)), {
      userId,
    });
    throw error;
  }
}

/**
 * Execute Master Agent with sub-agent invocation support
 */
async function executeMasterAgentWithSubAgents(
  client: OpenAI,
  options: {
    agentName: string;
    agentPrompt: string;
    userId: number;
    user: User;
    message: string;
    allowMissingUser: boolean;
    tools: OpenAI.Responses.FunctionTool[];
    customExecuteTool: (toolName: string, args: any) => Promise<any>;
    isFirstMessage?: boolean;
    longTermMemory?: any;
    shortTermMemory?: any;
  }
): Promise<string> {
  const { agentName, agentPrompt, userId, user, message, allowMissingUser, tools, customExecuteTool, isFirstMessage = false, longTermMemory, shortTermMemory } = options;
  
  const greeting = "Hi! I'm Shrey. I love making plans that people actually show up to!\n\nBefore we get started, I need some basic details.";
  let onboardingInvoked = false;
  let subAgentResponses: Array<{ agent: string; response: string; data?: any }> = [];

  // Use base executor but with custom tool handling
  // We need to modify the base executor to use our custom tool executor
  // For now, let's use a simplified approach that handles sub-agents
  
  // Import ensureConversation
  const { ensureConversation } = await import('../utils/conversationManager');
  
  // Ensure Master Agent conversation with its prompt as system message
  // Master Agent uses conversation_id (agentName is undefined for master)
  let conversationId = await ensureConversation(
    userId, 
    client, 
    false, 
    allowMissingUser,
    agentPrompt, // Use agent prompt as system message
    undefined, // Master Agent uses conversation_id, not agent_conversation_ids
    user // Pass user object to avoid redundant fetch
  );
  
  if (!conversationId && allowMissingUser) {
    // Create temporary conversation for Master Agent with its prompt
    const tempConversation = await client.conversations.create({
      items: [
        {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: agentPrompt,
            },
          ],
        },
      ],
    });
    conversationId = tempConversation.id;
  }

  if (!conversationId) {
    throw new Error(`Conversation not available for user ${userId}`);
  }

  // Add user message
  await client.conversations.items.create(conversationId, {
    items: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: message,
          },
        ],
      },
    ],
  });

  const maxIterations = 10;
  let iteration = 0;
  let finalResponse = '';

  while (iteration < maxIterations) {
    iteration++;

    const inputValue = iteration === 1 ? [
      {
        type: 'message' as const,
        role: 'user' as const,
        content: [
          {
            type: 'input_text' as const,
            text: message,
          },
        ],
      },
    ] : [];

    // Prepare request options
    const requestOptions = {
      model: 'gpt-5-mini',
      conversation: conversationId,
      input: inputValue,
      tools: tools.length > 0 ? tools : undefined,
      reasoning: { effort: 'low' as const },
    };
    
    // Log LLM input for Master Agent - full details
    const inputDetails = Array.isArray(inputValue) 
      ? inputValue.map((item: any) => {
          if (Array.isArray(item.content)) {
            return {
              role: item.role,
              content: item.content.map((c: any) => ({
                type: c.type,
                text: c.text || c.text === '' ? c.text : undefined,
                textLength: c.text?.length || 0,
              })),
            };
          }
          return {
            role: item.role,
            content: typeof item.content === 'string' ? item.content : item.content,
            contentLength: typeof item.content === 'string' ? item.content.length : undefined,
          };
        })
      : inputValue;
    
    logger.info('LLM Input (Master Agent)', {
      agent: 'master',
      userId,
      iteration,
      conversationId,
      model: requestOptions.model,
      input: inputDetails,
      inputLength: Array.isArray(inputValue) 
        ? inputValue.reduce((sum: number, item: any) => {
            if (Array.isArray(item.content)) {
              return sum + item.content.reduce((s: number, c: any) => s + (c.text?.length || 0), 0);
            }
            return sum + (typeof item.content === 'string' ? item.content.length : 0);
          }, 0)
        : 0,
      hasTools: tools.length > 0,
      toolCount: tools.length,
      toolNames: tools.map(t => {
        const tool = t as any;
        return tool.name || tool.function?.name || 'unknown';
      }),
      reasoning: requestOptions.reasoning,
      fullRequest: {
        model: requestOptions.model,
        conversation: requestOptions.conversation,
        input: requestOptions.input,
        tools: requestOptions.tools ? requestOptions.tools.map((t: any) => {
          const tool = t as any;
          return {
            name: tool.name || tool.function?.name,
            description: tool.description || tool.function?.description?.substring(0, 100),
          };
        }) : undefined,
        reasoning: requestOptions.reasoning,
      },
    });
    
    const response = await client.responses.create(requestOptions);
    
    // Log LLM output for Master Agent
    logger.info('LLM Output (Master Agent)', {
      agent: 'master',
      userId,
      iteration,
      conversationId,
      outputText: response.output_text?.substring(0, 500) + (response.output_text && response.output_text.length > 500 ? '...' : ''),
      outputTextLength: response.output_text?.length || 0,
      outputItemCount: Array.isArray(response.output) ? response.output.length : 0,
      hasToolCalls: Array.isArray(response.output) && response.output.some((item: any) => item.type === 'function_call'),
      toolCalls: Array.isArray(response.output) 
        ? response.output
            .filter((item: any) => item.type === 'function_call')
            .map((item: any) => ({
              name: item.name,
              call_id: item.call_id,
              arguments: item.arguments?.substring(0, 200) + (item.arguments && item.arguments.length > 200 ? '...' : ''),
            }))
        : [],
    });

    // Check for tool calls
    const toolCalls: Array<{ call_id: string; name: string; arguments: any }> = [];
    
    if (response.output && Array.isArray(response.output)) {
      for (const item of response.output) {
        if (item.type === 'function_call' && 'name' in item && 'call_id' in item) {
          const toolCall = item as OpenAI.Responses.ResponseFunctionToolCall;
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(toolCall.arguments);
          } catch (e) {
            // If parsing fails, use empty object
          }
          toolCalls.push({
            call_id: toolCall.call_id,
            name: toolCall.name,
            arguments: parsedArgs,
          });
        }
      }
    }

    // Execute tool calls
    if (toolCalls.length > 0) {
      logger.info(`Master Agent: Executing ${toolCalls.length} tool call(s)`, {
        agent: 'master',
        userId,
        iteration,
        toolCalls: toolCalls.map(tc => ({
          name: tc.name,
          call_id: tc.call_id,
          arguments: JSON.stringify(tc.arguments).substring(0, 200),
        })),
      });

      const toolResults: Array<{ call_id: string; content: string }> = [];

      for (const toolCall of toolCalls) {
        logger.info(`Master Agent: Executing tool call`, {
          agent: 'master',
          userId,
          iteration,
          toolName: toolCall.name,
          toolCallId: toolCall.call_id,
          arguments: JSON.stringify(toolCall.arguments).substring(0, 500),
        });
        
        try {
          let toolResult: any;

          // Check if it's a sub-agent invocation
          if (toolCall.name.startsWith('invoke_')) {
            logger.info(`Master Agent: Invoking sub-agent`, {
              agent: 'master',
              userId,
              iteration,
              subAgentTool: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments).substring(0, 200),
            });
            
            toolResult = await customExecuteTool(toolCall.name, toolCall.arguments);
            
            // Extract agent name and response
            const agentName = toolCall.name.replace('invoke_', '').replace('_agent', '');
            
            logger.info(`Master Agent: Sub-agent invocation completed`, {
              agent: 'master',
              userId,
              iteration,
              subAgent: agentName,
              resultType: typeof toolResult,
              hasResponse: !!toolResult?.response,
            });
            
            // Track if onboarding agent was invoked
            if (toolCall.name === 'invoke_onboarding_agent') {
              onboardingInvoked = true;
              logger.info(`Master Agent: Onboarding agent invoked flag set`, {
                agent: 'master',
                userId,
                iteration,
              });
            }
            
            // Extract response from sub-agent result
            let agentResponse = '';
            if (toolCall.name === 'invoke_onboarding_agent') {
              const onboardingResult = toolResult as OnboardingAgentOutput;
              agentResponse = onboardingResult.response || '';
              
              // Log sub-agent result received by Master Agent
              logger.info('Master Agent: Received Sub-Agent Result (Onboarding)', {
                agent: 'master',
                subAgent: 'onboarding',
                userId,
                responseLength: agentResponse.length,
                response: agentResponse.substring(0, 500) + (agentResponse.length > 500 ? '...' : ''),
                onboardingComplete: onboardingResult.onboardingComplete,
                hasPersona: !!onboardingResult.persona,
              });
              
              // Handle onboarding agent result - update long-term memory
              if (onboardingResult.onboardingComplete && onboardingResult.persona) {
                await updateLongTermMemory(userId, onboardingResult.persona);
                logger.info('Master Agent: Updated long-term memory from Onboarding Agent', {
                  userId,
                });
              }
            } else if (toolCall.name === 'invoke_planning_agent' || toolCall.name === 'invoke_summary_agent') {
              agentResponse = toolResult.response || '';
              
              // Log sub-agent result received by Master Agent
              logger.info(`Master Agent: Received Sub-Agent Result (${agentName})`, {
                agent: 'master',
                subAgent: agentName,
                userId,
                responseLength: agentResponse.length,
                response: agentResponse.substring(0, 500) + (agentResponse.length > 500 ? '...' : ''),
              });
            }
            
            // Store sub-agent response for repackaging
            if (agentResponse) {
              subAgentResponses.push({
                agent: agentName,
                response: agentResponse,
                data: toolResult,
              });
            }

            // Update short-term memory with active agent
            await mergeShortTermMemory(userId, {
              activeAgent: toolCall.name === 'invoke_onboarding_agent' ? 'onboarding' :
                          toolCall.name === 'invoke_planning_agent' ? 'planning' :
                          toolCall.name === 'invoke_summary_agent' ? 'summary' : null,
            }, user);
            
            // Return structured result for Master Agent to process
            toolResult = {
              agent: agentName,
              response: agentResponse,
              ...toolResult,
            };
          } else {
            logger.info(`Master Agent: Executing regular tool`, {
              agent: 'master',
              userId,
              iteration,
              toolName: toolCall.name,
            });
            
            toolResult = await customExecuteTool(toolCall.name, toolCall.arguments);
            
            logger.info(`Master Agent: Regular tool execution completed`, {
              agent: 'master',
              userId,
              iteration,
              toolName: toolCall.name,
              resultType: typeof toolResult,
            });
          }

          const resultString = JSON.stringify(toolResult);
          
          logger.info(`Master Agent: Tool result prepared`, {
            agent: 'master',
            userId,
            iteration,
            toolName: toolCall.name,
            resultLength: resultString.length,
            resultPreview: resultString.substring(0, 200),
          });

          toolResults.push({
            call_id: toolCall.call_id,
            content: resultString,
          });
        } catch (error) {
          logger.error('Master Agent: Tool execution failed', error instanceof Error ? error : new Error(String(error)), {
            agent: 'master',
            userId,
            iteration,
            toolName: toolCall.name,
            toolCallId: toolCall.call_id,
            arguments: JSON.stringify(toolCall.arguments).substring(0, 200),
          });
          toolResults.push({
            call_id: toolCall.call_id,
            content: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          });
        }
      }
      
      logger.info(`Master Agent: All tool calls completed`, {
        agent: 'master',
        userId,
        iteration,
        toolCallCount: toolCalls.length,
        toolResultCount: toolResults.length,
        subAgentResponsesCount: subAgentResponses.length,
      });

      // Add tool results to conversation
      await client.conversations.items.create(conversationId, {
        items: toolResults.map((result) => ({
          type: 'function_call_output',
          call_id: result.call_id,
          output: [
            {
              type: 'input_text',
              text: result.content,
            },
          ],
        })),
      });

      // Continue loop to get final response
      continue;
    }

    // No tool calls, extract response
    finalResponse = response.output_text || 'I apologize, but I could not generate a response.';
    
    // Repackage response if sub-agents were invoked
    if (subAgentResponses.length > 0) {
      const originalResponse = finalResponse;
      finalResponse = repackageSubAgentResponse(
        finalResponse,
        subAgentResponses,
        isFirstMessage,
        greeting
      );
      
      // Log repackaging
      logger.info('Master Agent: Repackaged Sub-Agent Response', {
        agent: 'master',
        userId,
        subAgents: subAgentResponses.map(sar => sar.agent),
        originalResponseLength: originalResponse.length,
        repackagedResponseLength: finalResponse.length,
        repackagedResponse: finalResponse.substring(0, 500) + (finalResponse.length > 500 ? '...' : ''),
        wasModified: originalResponse !== finalResponse,
      });
    } else {
      // If this is the first message and onboarding was invoked, prepend the greeting
      if (isFirstMessage && onboardingInvoked && !finalResponse.includes("Hi! I'm Shrey")) {
        finalResponse = `${greeting}\n\n${finalResponse}`;
      }
    }
    
    // Update short-term memory with conversation context
    await mergeShortTermMemory(userId, {
      conversationContext: {
        lastTopic: message.substring(0, 100),
      },
    }, user);

    break;
  }

  if (iteration >= maxIterations) {
    throw new Error('Master Agent exceeded maximum iterations');
  }

  // Final repackaging check: if sub-agents were invoked, ensure response is properly formatted
  if (subAgentResponses.length > 0) {
    finalResponse = repackageSubAgentResponse(
      finalResponse,
      subAgentResponses,
      isFirstMessage,
      greeting
    );
  } else {
    // Final check: if first message and response doesn't contain greeting, prepend it
    if (isFirstMessage && !finalResponse.includes("Hi! I'm Shrey")) {
      finalResponse = `${greeting}\n\n${finalResponse}`;
    }
  }

  return finalResponse;
}

/**
 * Repackage sub-agent responses to ensure they make sense and are properly formatted
 * 
 * This function ensures that sub-agent responses are properly integrated into
 * the Master Agent's voice and style, rather than being blindly forwarded.
 */
function repackageSubAgentResponse(
  masterResponse: string,
  subAgentResponses: Array<{ agent: string; response: string; data?: any }>,
  isFirstMessage: boolean,
  greeting: string
): string {
  logger.info('Master Agent: repackageSubAgentResponse - Entry', {
    operation: 'repackageSubAgentResponse',
    masterResponseLength: masterResponse.length,
    masterResponsePreview: masterResponse.substring(0, 200),
    subAgentCount: subAgentResponses.length,
    subAgents: subAgentResponses.map(sar => sar.agent),
    isFirstMessage,
  });
  
  // Check if Master Agent response seems to be just forwarding the sub-agent response
  // This happens when:
  // 1. Master response is identical to sub-agent response
  // 2. Master response is very short (likely just acknowledging)
  // 3. Master response contains the exact sub-agent response without modification
  
  const primarySubResponse = subAgentResponses[0].response;
  const masterTrimmed = masterResponse.trim();
  const subTrimmed = primarySubResponse.trim();
  
  const isDirectForwarding = 
    masterTrimmed === subTrimmed ||
    (masterTrimmed.length < 30 && masterTrimmed.length > 0) ||
    masterTrimmed.includes(subTrimmed.substring(0, Math.min(100, subTrimmed.length)));
  
  logger.info('Master Agent: repackageSubAgentResponse - Analysis', {
    operation: 'repackageSubAgentResponse',
    isDirectForwarding,
    masterLength: masterTrimmed.length,
    subLength: subTrimmed.length,
    responsesMatch: masterTrimmed === subTrimmed,
    masterContainsSub: masterTrimmed.includes(subTrimmed.substring(0, Math.min(100, subTrimmed.length))),
  });
  
  // If Master Agent didn't properly repackage, we need to do it
  // But ideally, Master Agent should handle this via prompt instructions
  // This is a fallback to ensure quality
  if (isDirectForwarding) {
    logger.info('Master Agent: repackageSubAgentResponse - Using sub-agent response as base', {
      operation: 'repackageSubAgentResponse',
      reason: 'direct_forwarding_detected',
      masterLength: masterTrimmed.length,
      subLength: subTrimmed.length,
    });
    
    // Use the sub-agent response, but ensure it's properly formatted
    let repackaged = primarySubResponse;
    
    // For first message with onboarding, ensure greeting is included
    if (isFirstMessage && subAgentResponses[0].agent === 'onboarding') {
      const hasGreeting = repackaged.includes("Hi! I'm Shrey");
      logger.info('Master Agent: repackageSubAgentResponse - Checking greeting for first message', {
        operation: 'repackageSubAgentResponse',
        isFirstMessage,
        agent: 'onboarding',
        hasGreeting,
      });
      
      if (!hasGreeting) {
        repackaged = `${greeting}\n\n${repackaged}`;
        logger.info('Master Agent: repackageSubAgentResponse - Added greeting prefix', {
          operation: 'repackageSubAgentResponse',
          repackagedLength: repackaged.length,
        });
      }
    }
    
    logger.info('Master Agent: repackageSubAgentResponse - Exit (Direct Forwarding)', {
      operation: 'repackageSubAgentResponse',
      finalLength: repackaged.length,
      finalPreview: repackaged.substring(0, 200),
    });
    
    return repackaged;
  }
  
  // Master Agent appears to have repackaged the response
  // But ensure greeting is included for first message if missing
  if (isFirstMessage && !masterResponse.includes("Hi! I'm Shrey")) {
    logger.info('Master Agent: repackageSubAgentResponse - Adding greeting to repackaged response', {
      operation: 'repackageSubAgentResponse',
      isFirstMessage,
      masterResponseLength: masterResponse.length,
    });
    
    const withGreeting = `${greeting}\n\n${masterResponse}`;
    
    logger.info('Master Agent: repackageSubAgentResponse - Exit (Greeting Added)', {
      operation: 'repackageSubAgentResponse',
      finalLength: withGreeting.length,
      finalPreview: withGreeting.substring(0, 200),
    });
    
    return withGreeting;
  }
  
  // Master Agent properly repackaged, use it as-is
  logger.info('Master Agent: repackageSubAgentResponse - Exit (Using Master Response)', {
    operation: 'repackageSubAgentResponse',
    finalLength: masterResponse.length,
    finalPreview: masterResponse.substring(0, 200),
    reason: 'master_properly_repackaged',
  });
  
  return masterResponse;
}
