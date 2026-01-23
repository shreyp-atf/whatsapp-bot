/**
 * Conversation Agent
 * 
 * This module provides a conversation agent that uses OpenAI's Conversations API
 * to manage conversation states. It automatically creates conversations for users
 * and manages the conversation history.
 * 
 * API Documentation: https://platform.openai.com/docs/api-reference/conversations
 */

import OpenAI from 'openai';
import { getUserById, updateUser } from '../db/user';
import { User } from '../types/database';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getActivityVenueMapsByCityAndDateTime } from '../db/activityVenueMap';
import { logger } from '../utils/logging';

export interface ConversationAgentConfig {
  apiKey?: string;
  systemPromptPath?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ConversationAgent {
  private client: OpenAI;
  private systemPrompt!: string;

  constructor(config?: ConversationAgentConfig) {
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required. Please set it in your .env file or pass it as a config parameter.');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });

    // Load system prompt from file if provided, otherwise use default
    if (config?.systemPromptPath) {
      try {
        this.systemPrompt = readFileSync(config.systemPromptPath, 'utf-8');
        console.log(`✓ Loaded system prompt from ${config.systemPromptPath}`);
      } catch (error) {
        console.warn(`Failed to load system prompt from ${config.systemPromptPath}, using default`);
        this.systemPrompt = this.getDefaultSystemPrompt();
      }
    } else {
      // Try to load from default location (src/ai/chatbot_prompt.md)
      // First try relative to current working directory (works in both dev and production)
      let defaultPath: string;
      let loaded = false;
      
      // Try 1: Relative to project root (process.cwd())
      try {
        defaultPath = join(process.cwd(), 'src', 'ai', 'chatbot_prompt.md');
        this.systemPrompt = readFileSync(defaultPath, 'utf-8');
        console.log(`✓ Loaded system prompt from ${defaultPath}`);
        loaded = true;
      } catch (error) {
        // Try 2: Relative to __dirname (works when compiled)
        try {
          defaultPath = join(__dirname, 'chatbot_prompt.md');
          this.systemPrompt = readFileSync(defaultPath, 'utf-8');
          console.log(`✓ Loaded system prompt from ${defaultPath}`);
          loaded = true;
        } catch (error2) {
          // Try 3: Relative to __dirname but go up one level (if in dist/ai/)
          try {
            defaultPath = join(__dirname, '..', 'src', 'ai', 'chatbot_prompt.md');
            this.systemPrompt = readFileSync(defaultPath, 'utf-8');
            console.log(`✓ Loaded system prompt from ${defaultPath}`);
            loaded = true;
          } catch (error3) {
            // All attempts failed
          }
        }
      }
      
      if (!loaded) {
        console.warn('Failed to load system prompt from chatbot_prompt.md, using fallback');
        this.systemPrompt = this.getDefaultSystemPrompt();
      }
    }
  }

  private getDefaultSystemPrompt(): string {
    return 'You are a helpful assistant.';
  }

  /**
   * Get available tools for OpenAI function calling
   */
  private getAvailableTools(): OpenAI.Responses.FunctionTool[] {
    return [
      {
        type: 'function' as const,
        name: 'fetch_activity_venue_maps',
        description: 'Fetch activity venue maps happening at a given date and time in the same city as the user',
        parameters: {
          type: 'object',
          properties: {
            datetime: {
              type: 'string',
              description: 'ISO 8601 datetime string (e.g., "2024-01-15T18:00:00Z")',
            },
          },
          required: ['datetime'],
          additionalProperties: false,
        },
        strict: true,
      },
    ];
  }

  /**
   * Execute the fetch_activity_venue_maps tool
   * @param userId - The user ID
   * @param datetime - ISO 8601 datetime string
   * @returns Formatted results as JSON string
   */
  private async fetchActivityVenueMaps(userId: number, datetime: string): Promise<string> {
    try {
      const results = await getActivityVenueMapsByCityAndDateTime(userId, datetime);
      
      // Format results for the AI
      const formattedResults = results.map((avm) => ({
        id: avm.id,
        activity_id: avm.activity_id,
        venue_id: avm.venue_id,
        venue_name: avm.venue_name,
        venue_address: avm.venue_address,
        city_name: avm.city_name,
        date: avm.date,
        start_time: avm.start_time,
        end_time: avm.end_time,
        description: avm.description,
        max_people: avm.max_people,
        is_ticketed: avm.is_ticketed,
        ticket_price: avm.ticket_price,
        booking_link: avm.booking_link,
        img_url: avm.img_url,
      }));

      return JSON.stringify({
        success: true,
        count: formattedResults.length,
        results: formattedResults,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  /**
   * Ensure the user has a conversation_id. If null, create a new conversation.
   * @param userId - The user ID
   * @returns The conversation ID
   */
  async ensureConversation(userId: number): Promise<string> {
    const user = await getUserById(userId);

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // If user already has a conversation_id, return it
    if (user.conversation_id) {
      return user.conversation_id;
    }

    // Create a new conversation
    const conversation = await this.client.conversations.create({
      items: [
        {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: this.systemPrompt,
            },
          ],
        },
      ],
    });

    // Update user with the new conversation_id
    await updateUser(userId, {
      conversation_id: conversation.id,
    });

    return conversation.id;
  }

  /**
   * Add a user message to the conversation
   * @param userId - The user ID
   * @param message - The user's message content
   * @returns The created conversation item
   */
  async addUserMessage(userId: number, message: string): Promise<string> {
    const conversationId = await this.ensureConversation(userId);

    const result = await this.client.conversations.items.create(conversationId, {
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

    // Return the ID of the first created item
    return result.data[0]?.id || '';
  }

  /**
   * Get the conversation history for a user
   * @param userId - The user ID
   * @param limit - Maximum number of items to retrieve (default: 50)
   * @returns Array of conversation messages
   */
  async getConversationHistory(userId: number, limit: number = 50): Promise<ConversationMessage[]> {
    const user = await getUserById(userId);

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    if (!user.conversation_id) {
      return [];
    }

    const items = await this.client.conversations.items.list(user.conversation_id, {
      limit,
      order: 'asc', // Get items in chronological order
    });

    const messages: ConversationMessage[] = [];

    for await (const item of items) {
      if (item.type === 'message' && 'role' in item && 'content' in item) {
        const message = item as any;
        const role = message.role as 'user' | 'assistant' | 'system';
        
        // Extract text content from the content array
        let textContent = '';
        if (Array.isArray(message.content)) {
          for (const contentItem of message.content) {
            if (contentItem.type === 'text' && 'text' in contentItem) {
              textContent += contentItem.text;
            }
          }
        }

        if (textContent) {
          messages.push({
            role,
            content: textContent,
          });
        }
      }
    }

    return messages;
  }

  /**
   * Send a message and get a response from the assistant
   * This uses the Responses API with the conversation context
   * Supports tool calling for function execution
   * @param userId - The user ID
   * @param message - The user's message
   * @param options - Optional configuration
   * @returns The assistant's response
   */
  async sendMessage(
    userId: number,
    message: string,
    options?: {
      model?: string;
      temperature?: number;
    }
  ): Promise<string> {
    const conversationId = await this.ensureConversation(userId);

    // Add user message to conversation
    await this.addUserMessage(userId, message);

    const tools = this.getAvailableTools();
    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // OpenAI Responses API requires 'input' parameter on every call
      // On first iteration, include the user message; on subsequent iterations (after tool calls), provide empty string
      // Build request conditionally to satisfy both TypeScript types and API requirements
      const requestParams: any = {
        model: options?.model || 'gpt-5-mini',
        conversation: conversationId,
        tools: tools.length > 0 ? tools : undefined,
        // temperature parameter removed - gpt-5-mini doesn't support it
        reasoning: { effort: 'low' },
      };

      if (iteration === 1) {
        // First iteration: include user message as input
        requestParams.input = [
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
        ];
      } else {
        // Subsequent iterations: API requires input parameter, provide empty string
        requestParams.input = '';
      }

      // Log LLM input
      const inputDetails = Array.isArray(requestParams.input) 
        ? requestParams.input.map((item: any) => {
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
        : requestParams.input === '' ? 'empty string' : requestParams.input;
      
      logger.info('LLM Input (ConversationAgent)', {
        agent: 'ConversationAgent',
        userId,
        iteration,
        model: requestParams.model,
        conversationId: requestParams.conversation,
        input: inputDetails,
        inputLength: Array.isArray(requestParams.input) 
          ? requestParams.input.reduce((sum: number, item: any) => {
              if (Array.isArray(item.content)) {
                return sum + item.content.reduce((s: number, c: any) => s + (c.text?.length || 0), 0);
              }
              return sum + (typeof item.content === 'string' ? item.content.length : 0);
            }, 0)
          : requestParams.input === '' ? 0 : (typeof requestParams.input === 'string' ? requestParams.input.length : 0),
        hasTools: !!requestParams.tools,
        toolCount: requestParams.tools?.length || 0,
        toolNames: requestParams.tools?.map((t: any) => t.name || t.function?.name || 'unknown') || [],
        reasoning: requestParams.reasoning,
        fullRequest: {
          model: requestParams.model,
          conversation: requestParams.conversation,
          input: requestParams.input,
          tools: requestParams.tools ? requestParams.tools.map((t: any) => ({
            name: t.name || t.function?.name,
            description: t.description || t.function?.description?.substring(0, 100),
          })) : undefined,
          reasoning: requestParams.reasoning,
        },
      });

      // Create a response using the Responses API with conversation context and tools
      // Type assertion needed because the SDK types are stricter than the actual API accepts
      const response = await this.client.responses.create(requestParams as any);

      // Check if there are tool calls in the response
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

      // If there are tool calls, execute them and continue the conversation
      if (toolCalls.length > 0) {
        console.log(`[Tool Call] Detected ${toolCalls.length} tool call(s) for user ${userId}`);
        
        const toolResults: Array<{ call_id: string; content: string }> = [];

        for (const toolCall of toolCalls) {
          console.log(`[Tool Call] Executing tool: ${toolCall.name}`, {
            call_id: toolCall.call_id,
            arguments: toolCall.arguments,
            userId,
          });

          let toolResult: string;

          if (toolCall.name === 'fetch_activity_venue_maps') {
            const { datetime } = toolCall.arguments;
            if (!datetime) {
              console.log(`[Tool Call] Error: ${toolCall.name} - datetime parameter is required`);
              toolResult = JSON.stringify({
                success: false,
                error: 'datetime parameter is required',
              });
            } else {
              toolResult = await this.fetchActivityVenueMaps(userId, datetime);
              const parsedResult = JSON.parse(toolResult);
              console.log(`[Tool Call] Completed: ${toolCall.name}`, {
                call_id: toolCall.call_id,
                success: parsedResult.success,
                resultCount: parsedResult.count || 0,
              });
            }
          } else {
            console.log(`[Tool Call] Error: Unknown tool: ${toolCall.name}`);
            toolResult = JSON.stringify({
              success: false,
              error: `Unknown tool: ${toolCall.name}`,
            });
          }

          toolResults.push({
            call_id: toolCall.call_id,
            content: toolResult,
          });
        }

        // Add tool results to the conversation
        await this.client.conversations.items.create(conversationId, {
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

        // Continue the conversation loop to get the final response
        continue;
      }

      // No tool calls, extract and return the final response
      const responseText = response.output_text || 'I apologize, but I could not generate a response.';
      return responseText;
    }

    // If we've exceeded max iterations, return an error message
    return 'I apologize, but I encountered an issue processing your request. Please try again.';
  }

  /**
   * Get or create a conversation for a user
   * @param userId - The user ID
   * @returns The conversation object
   */
  async getOrCreateConversation(userId: number): Promise<OpenAI.Conversations.Conversation> {
    const conversationId = await this.ensureConversation(userId);
    return await this.client.conversations.retrieve(conversationId);
  }

  /**
   * Delete a conversation (but keep the items)
   * @param userId - The user ID
   */
  async deleteConversation(userId: number): Promise<void> {
    const user = await getUserById(userId);

    if (!user || !user.conversation_id) {
      return;
    }

    await this.client.conversations.delete(user.conversation_id);

    // Clear conversation_id from user
    await updateUser(userId, {
      conversation_id: null,
    });
  }
}

// Export a singleton instance (lazy initialization)
let _conversationAgentInstance: ConversationAgent | null = null;

function createConversationAgent(): ConversationAgent {
  if (!_conversationAgentInstance) {
    _conversationAgentInstance = new ConversationAgent();
  }
  return _conversationAgentInstance;
}

// Export singleton getter - initializes on first access
export const conversationAgent = new Proxy({} as ConversationAgent, {
  get(_target, prop) {
    const agent = createConversationAgent();
    const value = agent[prop as keyof ConversationAgent];
    if (typeof value === 'function') {
      return value.bind(agent);
    }
    return value;
  }
});

