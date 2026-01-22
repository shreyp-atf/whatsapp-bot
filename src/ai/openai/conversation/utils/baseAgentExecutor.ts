/**
 * Base Agent Executor
 * 
 * Common functionality for executing agents with OpenAI
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { ensureConversation, addAgentContext } from './conversationManager';
import { getOpenAITools, executeTool } from '../tools/userTools';
import { loadSystemMessage } from './promptLoader';
import { logger } from '../../../utils/logging';

export interface AgentExecutionOptions {
  model?: string;
  temperature?: number;
  agentName: string;
  agentPrompt: string;
  userId: number;
  message: string;
  addAgentContext?: boolean;
  outputSchema?: z.ZodSchema<any>;
  createUserIfNotExists?: boolean; // For onboarding agent
  allowMissingUser?: boolean; // For Master Agent to check user existence
}

/**
 * Execute an agent with tool calling support
 */
export async function executeAgentWithTools<T>(
  client: OpenAI,
  options: AgentExecutionOptions
): Promise<T> {
  const {
    model = 'gpt-4o',
    temperature = 0.7,
    agentName,
    agentPrompt,
    userId,
    message,
    addAgentContext: shouldAddContext = false,
    outputSchema,
    createUserIfNotExists = false,
    allowMissingUser = false,
  } = options;

  let conversationId = await ensureConversation(userId, client, createUserIfNotExists, allowMissingUser);
  
  // If conversationId is null (user doesn't exist and allowMissingUser is true)
  // Master Agent will handle this case - we need to create a temporary conversation
  // or handle it differently. For now, let's create a temporary conversation for Master Agent
  if (!conversationId && allowMissingUser) {
    // Create a temporary conversation for Master Agent to use
    // This will be properly set up when Onboarding Agent creates the user
    const systemMessage = loadSystemMessage();
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
    });
  }

  if (!conversationId) {
    throw new Error(`Conversation not available for user ${userId}`);
  }

  // Prepare the message with agent context if needed
  let finalMessage = message;
  if (shouldAddContext) {
    finalMessage = addAgentContext(message, agentName, agentPrompt);
  }

  // Add user message to conversation
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

  const tools = getOpenAITools();
  const maxIterations = 10;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // Prepare response options
    const responseOptions: any = {
      model,
      conversation: conversationId,
      input: iteration === 1 ? [
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
      ] : undefined,
      tools: tools.length > 0 ? tools : undefined,
      temperature,
    };

    // Add structured output if schema provided
    // Note: For now, we'll request JSON format and validate with Zod after parsing
    // OpenAI structured outputs require JSON Schema, which we'll handle via prompt instructions
    if (outputSchema) {
      // Add instruction to return JSON in the prompt itself
      // The response will be validated with Zod after parsing
    }

    // Create a response using the Responses API
    const response = await client.responses.create(responseOptions);

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
        toolCalls: toolCalls.map(tc => tc.name),
      });

      const toolResults: Array<{ call_id: string; content: string }> = [];

      for (const toolCall of toolCalls) {
        try {
          const toolResult = await executeTool(toolCall.name, toolCall.arguments, userId, client);
          toolResults.push({
            call_id: toolCall.call_id,
            content: JSON.stringify(toolResult),
          });
        } catch (error) {
          logger.error(`Agent ${agentName}: Tool execution failed`, error instanceof Error ? error : new Error(String(error)), {
            agent: agentName,
            userId,
            toolName: toolCall.name,
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
    if (outputSchema && response.output_text) {
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
        return validated as T;
      } catch (error) {
        logger.error(`Agent ${agentName}: Failed to parse structured output`, error instanceof Error ? error : new Error(String(error)), {
          agent: agentName,
          userId,
          outputText: response.output_text?.substring(0, 500),
        });
        throw new Error(`Failed to parse agent output: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Return text response (for agents without structured output)
    const textResponse = response.output_text || 'I apologize, but I could not generate a response.';
    return textResponse as T;
  }

  throw new Error(`Agent ${agentName} exceeded maximum iterations`);
}
