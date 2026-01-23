/**
 * Base Agent Executor
 * 
 * Common functionality for executing agents with OpenAI
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { ensureConversation } from './conversationManager';
import { getOpenAITools, executeTool } from '../tools/userTools';
import { getSubAgentTools } from '../tools/subAgentTools';
import { loadSystemMessage } from './promptLoader';
import { logger } from '../../../utils/logging';
import { User } from '../../../../types/database';

export interface AgentExecutionOptions {
  model?: string;
  temperature?: number;
  agentName: string;
  agentPrompt: string;
  userId: number;
  message: string;
  outputSchema?: z.ZodSchema<any>;
  createUserIfNotExists?: boolean; // For onboarding agent
  allowMissingUser?: boolean; // For Master Agent to check user existence
  isSubAgent?: boolean; // If true, use restricted tools (no response capabilities)
  user?: User; // Optional user object (if provided, avoids database fetch)
}

/**
 * Execute an agent with tool calling support
 */
export async function executeAgentWithTools<T>(
  client: OpenAI,
  options: AgentExecutionOptions
): Promise<T> {
  const {
    model = 'gpt-5-mini',
    temperature = 0.7,
    agentName,
    agentPrompt,
    userId,
    message,
    outputSchema,
    createUserIfNotExists = false,
    allowMissingUser = false,
    isSubAgent = true, // Default to sub-agent (restricted tools) unless explicitly Master Agent
    user,
  } = options;

  // Determine agent name for conversation storage
  // Master Agent uses 'master' or undefined, sub-agents use their agentName
  const conversationAgentName = isSubAgent ? agentName : undefined;
  
  // Pass agentPrompt and agentName to ensureConversation
  // Agent prompt will be used as system message
  let conversationId = await ensureConversation(
    userId, 
    client, 
    createUserIfNotExists, 
    allowMissingUser,
    agentPrompt,
    conversationAgentName,
    user // Pass user object to avoid redundant fetch
  );
  
  // If conversationId is null (user doesn't exist and allowMissingUser is true)
  // Master Agent will handle this case - we need to create a temporary conversation
  // or handle it differently. For now, let's create a temporary conversation for Master Agent
  if (!conversationId && allowMissingUser) {
    // Create a temporary conversation for Master Agent to use
    // This will be properly set up when Onboarding Agent creates the user
    const systemMessage = agentPrompt || loadSystemMessage();
    const tempConversation = await client.conversations.create({
      items: [
        {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: systemMessage,
            },
          ],
        },
      ],
    });
    conversationId = tempConversation.id;
    logger.info('Created temporary conversation for Master Agent', {
      userId,
      conversationId,
      agentName,
    });
  }

  if (!conversationId) {
    throw new Error(`Conversation not available for user ${userId}`);
  }

  // Use message as-is (no agent context added since prompt is system message)
  const finalMessage = message;
  
  logger.info('Base Agent Executor: Message prepared', {
    agent: agentName,
    userId,
    messageLength: finalMessage.length,
    conversationId,
    isSubAgent,
  });

  // Add user message to conversation
  // #region agent log
  fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:87',message:'Adding message to conversation',data:{conversationId,hasFinalMessage:!!finalMessage,finalMessageLength:finalMessage?.length,agentName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  // #region agent log
  try {
    const convItems = await client.conversations.items.list(conversationId, { limit: 100 });
    let itemCount = 0;
    let totalChars = 0;
    for await (const item of convItems) {
      itemCount++;
      if (item.type === 'message' && 'content' in item) {
        const content = (item as any).content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.text) totalChars += c.text.length;
            if (c.type === 'input_text' && c.text) totalChars += c.text.length;
          }
        }
      }
    }
    console.log('\n=== CONVERSATION SIZE ===');
    console.log('Agent Name:', agentName);
    console.log('Conversation ID:', conversationId);
    console.log('Total Items in Conversation:', itemCount);
    console.log('Total Characters in Conversation:', totalChars);
    console.log('New Message Length:', finalMessage.length);
    console.log('Total After Adding:', totalChars + finalMessage.length);
    console.log('================================\n');
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:95',message:'Conversation size before adding message',data:{conversationId,itemCount,totalChars,agentName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  } catch (e) {
    console.log('Error getting conversation size:', e);
  }
  // #endregion
  
  await client.conversations.items.create(conversationId, {
    items: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: finalMessage,
          },
        ],
      },
    ],
  });
  // #region agent log
  fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:101',message:'Message added to conversation',data:{conversationId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  // Sub-agents get restricted tools (no response capabilities)
  // Master Agent gets full tools
  const tools = isSubAgent ? getSubAgentTools() : getOpenAITools();
  const maxIterations = 10;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:107',message:'Loop iteration start',data:{iteration,conversationId,hasFinalMessage:!!finalMessage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Prepare response options
    // OpenAI Responses API requires 'input' parameter on every call
    // On first iteration, include the user message; on subsequent iterations (after tool calls), use empty array
    const inputValue = iteration === 1 ? [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: finalMessage,
          },
        ],
      },
    ] : [];

    // #region agent log
    if (iteration === 1) {
      console.log('\n=== API CALL INPUT (Iteration 1) ===');
      console.log('Agent Name:', agentName);
      console.log('Input Value Type:', Array.isArray(inputValue) ? 'array' : typeof inputValue);
      console.log('Input Message Length:', finalMessage.length);
      console.log('--- Input Message (first 1000 chars) ---');
      console.log(finalMessage.substring(0, 1000) + (finalMessage.length > 1000 ? '...' : ''));
      console.log('================================\n');
    } else {
      console.log(`\n=== API CALL INPUT (Iteration ${iteration}) ===`);
      console.log('Agent Name:', agentName);
      console.log('Input Value: Empty array (conversation continues)');
      console.log('================================\n');
    }
    // #endregion

    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:125',message:'Input value prepared',data:{iteration,inputValue:inputValue===undefined?'undefined':Array.isArray(inputValue)?'array':typeof inputValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const responseOptions: any = {
      model,
      conversation: conversationId,
      input: inputValue,
      tools: tools.length > 0 ? tools : undefined,
      // temperature parameter removed - gpt-5-mini doesn't support it
      reasoning: { effort: 'low' },
    };

    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:133',message:'Response options before API call',data:{iteration,hasInput:'input' in responseOptions,inputValue:responseOptions.input===undefined?'undefined':Array.isArray(responseOptions.input)?'array':typeof responseOptions.input,hasConversation:!!responseOptions.conversation,hasTools:!!responseOptions.tools},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:136',message:'About to call responses.create',data:{iteration,conversationId:!!conversationId,conversationIdLength:conversationId?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Add structured output if schema provided
    // Note: For now, we'll request JSON format and validate with Zod after parsing
    // OpenAI structured outputs require JSON Schema, which we'll handle via prompt instructions
    if (outputSchema) {
      // Add instruction to return JSON in the prompt itself
      // The response will be validated with Zod after parsing
    }

    // Create a response using the Responses API
    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'baseAgentExecutor.ts:149',message:'Calling responses.create',data:{iteration,responseOptionsKeys:Object.keys(responseOptions),inputInOptions:'input' in responseOptions},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Log LLM input - full details
    const inputDetails = Array.isArray(responseOptions.input) 
      ? responseOptions.input.map((item: any) => {
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
      : responseOptions.input;
    
    logger.info('LLM Input', {
      agent: agentName,
      userId,
      iteration,
      model: responseOptions.model,
      conversationId: responseOptions.conversation,
      input: inputDetails,
      inputLength: Array.isArray(responseOptions.input) 
        ? responseOptions.input.reduce((sum: number, item: any) => {
            if (Array.isArray(item.content)) {
              return sum + item.content.reduce((s: number, c: any) => s + (c.text?.length || 0), 0);
            }
            return sum + (typeof item.content === 'string' ? item.content.length : 0);
          }, 0)
        : 0,
      hasTools: !!responseOptions.tools,
      toolCount: responseOptions.tools?.length || 0,
      toolNames: responseOptions.tools?.map((t: any) => t.name || t.function?.name || 'unknown') || [],
      reasoning: responseOptions.reasoning,
      fullRequest: {
        model: responseOptions.model,
        conversation: responseOptions.conversation,
        input: responseOptions.input,
        tools: responseOptions.tools ? responseOptions.tools.map((t: any) => ({
          name: t.name || t.function?.name,
          description: t.description || t.function?.description?.substring(0, 100),
        })) : undefined,
        reasoning: responseOptions.reasoning,
      },
    });
    
    const response = await client.responses.create(responseOptions);
    
    // Log LLM output
    logger.info('LLM Output', {
      agent: agentName,
      userId,
      iteration,
      conversationId: responseOptions.conversation,
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

    // Execute tool calls if any
    if (toolCalls.length > 0) {
      logger.info(`Agent ${agentName}: Executing ${toolCalls.length} tool call(s)`, {
        agent: agentName,
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
        logger.info(`Agent ${agentName}: Executing tool`, {
          agent: agentName,
          userId,
          iteration,
          toolName: toolCall.name,
          toolCallId: toolCall.call_id,
          arguments: JSON.stringify(toolCall.arguments).substring(0, 500),
        });
        
        try {
          const toolResult = await executeTool(toolCall.name, toolCall.arguments, userId, client);
          
          const resultString = JSON.stringify(toolResult);
          
          logger.info(`Agent ${agentName}: Tool execution succeeded`, {
            agent: agentName,
            userId,
            iteration,
            toolName: toolCall.name,
            toolCallId: toolCall.call_id,
            resultLength: resultString.length,
            resultPreview: resultString.substring(0, 500) + (resultString.length > 500 ? '...' : ''),
          });
          
          toolResults.push({
            call_id: toolCall.call_id,
            content: resultString,
          });
        } catch (error) {
          logger.error(`Agent ${agentName}: Tool execution failed`, error instanceof Error ? error : new Error(String(error)), {
            agent: agentName,
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
      
      logger.info(`Agent ${agentName}: All tool calls completed`, {
        agent: agentName,
        userId,
        iteration,
        toolCallCount: toolCalls.length,
        toolResultCount: toolResults.length,
      });

      // Add tool results to conversation
      logger.info(`Agent ${agentName}: Adding tool results to conversation`, {
        agent: agentName,
        userId,
        iteration,
        conversationId,
        toolResultCount: toolResults.length,
      });
      
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
      
      logger.info(`Agent ${agentName}: Tool results added, continuing to get final response`, {
        agent: agentName,
        userId,
        iteration,
      });

      // Continue loop to get final response
      continue;
    }

    // No tool calls, extract response
    if (outputSchema && response.output_text) {
      logger.info(`Agent ${agentName}: Parsing structured output`, {
        agent: agentName,
        userId,
        iteration,
        outputTextLength: response.output_text.length,
        outputTextPreview: response.output_text.substring(0, 500),
      });
      
      try {
        // Try to extract JSON from the response
        // The response might be pure JSON or contain JSON within text
        let jsonText = response.output_text.trim();
        
        // Try to find JSON object in the response
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        const parsed = JSON.parse(jsonText);
        const validated = outputSchema.parse(parsed);
        
        logger.info(`Agent ${agentName}: Structured output parsed and validated`, {
          agent: agentName,
          userId,
          iteration,
          validatedKeys: Object.keys(validated),
        });
        
        return validated as T;
      } catch (error) {
        logger.error(`Agent ${agentName}: Failed to parse structured output`, error instanceof Error ? error : new Error(String(error)), {
          agent: agentName,
          userId,
          iteration,
          outputText: response.output_text?.substring(0, 500),
          outputTextFull: response.output_text,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        
        // Log the raw response for debugging
        logger.error(`Agent ${agentName}: Raw LLM response that failed parsing`, new Error('Structured output parsing failed'), {
          agent: agentName,
          userId,
          iteration,
          rawResponse: response.output_text,
          responseLength: response.output_text?.length || 0,
        });
        
        // Fallback: Try to wrap plain text response in JSON structure
        // This handles cases where LLM returns plain text despite JSON instruction
        try {
          logger.warn(`Agent ${agentName}: Attempting fallback - wrapping plain text in JSON structure`, {
            agent: agentName,
            userId,
            iteration,
          });
          
          const plainText = response.output_text?.trim() || 'I apologize, but I could not generate a proper response.';
          
          // Create a fallback JSON structure with the plain text as the response
          const fallbackResponse = {
            response: plainText,
            onboardingComplete: false,
            userUpdates: {},
            persona: {},
          };
          
          // Validate the fallback structure
          const validated = outputSchema.parse(fallbackResponse);
          
          logger.warn(`Agent ${agentName}: Fallback successful - wrapped plain text in JSON structure`, {
            agent: agentName,
            userId,
            iteration,
            wrappedResponseLength: plainText.length,
          });
          
          return validated as T;
        } catch (fallbackError) {
          logger.error(`Agent ${agentName}: Fallback also failed`, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)), {
            agent: agentName,
            userId,
            iteration,
          });
          
          throw new Error(`Failed to parse agent output: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Return text response (for agents without structured output)
    const textResponse = response.output_text || 'I apologize, but I could not generate a response.';
    
    logger.info(`Agent ${agentName}: Returning text response`, {
      agent: agentName,
      userId,
      iteration,
      responseLength: textResponse.length,
      responsePreview: textResponse.substring(0, 500),
    });
    
    return textResponse as T;
  }

  logger.error(`Agent ${agentName}: Exceeded maximum iterations`, new Error('Maximum iterations exceeded'), {
    agent: agentName,
    userId,
    maxIterations,
  });
  
  throw new Error(`Agent ${agentName} exceeded maximum iterations`);
}
