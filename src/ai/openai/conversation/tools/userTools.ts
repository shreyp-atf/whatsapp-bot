/**
 * User Tools
 * 
 * Tools accessible to both OpenAI and xAI agents for user and conversation operations
 */

import { getUserById, createUser, updateUser, getUserPersona } from '../../../../db/user';
import { CreateUserInput, User } from '../../../../types/database';
import { getActivityVenueMapsByCityAndDateTime } from '../../../../db/activityVenueMap';
import { getShortTermMemory, updateShortTermMemory, mergeShortTermMemory, ShortTermMemory } from '../utils/memoryManager';
import { logger } from '../../../../utils/logging';
import OpenAI from 'openai';

/**
 * Get user by user ID
 */
export async function fetchUser(userId: number): Promise<User | null> {
  logger.info('Tool: fetchUser - Entry', {
    tool: 'fetch_user',
    userId,
  });
  
  const user = await getUserById(userId);
  
  logger.info('Tool: fetchUser - Exit', {
    tool: 'fetch_user',
    userId,
    userFound: !!user,
    hasConversationId: !!user?.conversation_id,
    hasPersona: !!user?.persona_json,
    hasShortTermMemory: !!user?.short_term_memory_json,
  });
  
  return user;
}

/**
 * Create a new user
 */
export async function createUserTool(userData: {
  user_id: number;
  name?: string;
  bio?: string;
  persona_json?: any;
  short_term_memory_json?: any;
  locality_id?: number;
  conversation_id?: string;
}): Promise<User> {
  logger.info('Tool: createUserTool - Entry', {
    tool: 'create_user',
    userId: userData.user_id,
    hasName: !!userData.name,
    hasBio: !!userData.bio,
    hasPersona: !!userData.persona_json,
    hasShortTermMemory: !!userData.short_term_memory_json,
    hasLocalityId: !!userData.locality_id,
    hasConversationId: !!userData.conversation_id,
  });
  
  const user = await createUser(userData);
  
  logger.info('Tool: createUserTool - Exit', {
    tool: 'create_user',
    userId: user.user_id,
    createdAt: user.created_at,
    hasConversationId: !!user.conversation_id,
  });
  
  return user;
}

/**
 * Update user information
 */
export async function updateUserTool(
  userId: number,
  updates: Partial<CreateUserInput>
): Promise<User> {
  logger.info('Tool: updateUserTool - Entry', {
    tool: 'update_user',
    userId,
    updateFields: Object.keys(updates),
    hasPersona: 'persona_json' in updates,
    hasShortTermMemory: 'short_term_memory_json' in updates,
  });
  
  const user = await updateUser(userId, updates);
  
  logger.info('Tool: updateUserTool - Exit', {
    tool: 'update_user',
    userId,
    updatedAt: user.updated_at,
    fieldsUpdated: Object.keys(updates).length,
  });
  
  return user;
}

/**
 * Get conversation history for a user
 * Uses OpenAI Conversations API to retrieve full conversation
 */
export async function getConversationHistory(
  userId: number,
  client: OpenAI,
  user?: User
): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
  logger.info('Tool: getConversationHistory - Entry', {
    tool: 'get_conversation_history',
    userId,
    hasUserObject: !!user,
  });
  
  const userData = user || await getUserById(userId);
  
  if (!userData || !userData.conversation_id) {
    logger.info('Tool: getConversationHistory - No conversation found', {
      tool: 'get_conversation_history',
      userId,
      hasUser: !!userData,
      hasConversationId: !!userData?.conversation_id,
    });
    return [];
  }

  logger.info('Tool: getConversationHistory - Fetching conversation items', {
    tool: 'get_conversation_history',
    userId,
    conversationId: userData.conversation_id,
  });

  const items = await client.conversations.items.list(userData.conversation_id, {
    limit: 100, // OpenAI API maximum limit
    order: 'asc',
  });

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  let itemCount = 0;

  for await (const item of items) {
    itemCount++;
    if (item.type === 'message' && 'role' in item && 'content' in item) {
      const message = item as any;
      const role = message.role as 'user' | 'assistant' | 'system';
      
      let textContent = '';
      if (Array.isArray(message.content)) {
        for (const contentItem of message.content) {
          if (contentItem.type === 'text' && 'text' in contentItem) {
            textContent += contentItem.text;
          } else if (contentItem.type === 'input_text' && 'text' in contentItem) {
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

  logger.info('Tool: getConversationHistory - Exit', {
    tool: 'get_conversation_history',
    userId,
    conversationId: userData.conversation_id,
    totalItems: itemCount,
    messageCount: messages.length,
    userMessageCount: messages.filter(m => m.role === 'user').length,
    assistantMessageCount: messages.filter(m => m.role === 'assistant').length,
    systemMessageCount: messages.filter(m => m.role === 'system').length,
  });

  return messages;
}

/**
 * Update user persona
 */
export async function updateUserPersona(
  userId: number,
  persona: any
): Promise<User> {
  logger.info('Tool: updateUserPersona - Entry', {
    tool: 'update_user_persona',
    userId,
    personaKeys: persona ? Object.keys(persona) : [],
    personaSize: persona ? JSON.stringify(persona).length : 0,
  });
  
  const user = await updateUser(userId, { persona_json: persona });
  
  logger.info('Tool: updateUserPersona - Exit', {
    tool: 'update_user_persona',
    userId,
    personaUpdated: true,
  });
  
  return user;
}

/**
 * Get short-term memory for a user
 */
export async function getShortTermMemoryTool(userId: number): Promise<ShortTermMemory | null> {
  logger.info('Tool: getShortTermMemoryTool - Entry', {
    tool: 'get_short_term_memory',
    userId,
  });
  
  const memory = await getShortTermMemory(userId);
  
  logger.info('Tool: getShortTermMemoryTool - Exit', {
    tool: 'get_short_term_memory',
    userId,
    hasMemory: !!memory,
    activeAgent: memory?.activeAgent || null,
    hasCurrentPlan: !!memory?.currentPlan,
    hasConversationContext: !!memory?.conversationContext,
  });
  
  return memory;
}

/**
 * Update short-term memory for a user
 */
export async function updateShortTermMemoryTool(
  userId: number,
  memory: ShortTermMemory
): Promise<User> {
  logger.info('Tool: updateShortTermMemoryTool - Entry', {
    tool: 'update_short_term_memory',
    userId,
    activeAgent: memory.activeAgent || null,
    hasCurrentPlan: !!memory.currentPlan,
    hasConversationContext: !!memory.conversationContext,
  });
  
  await updateShortTermMemory(userId, memory);
  const user = await getUserById(userId) as Promise<User>;
  
  logger.info('Tool: updateShortTermMemoryTool - Exit', {
    tool: 'update_short_term_memory',
    userId,
    memoryUpdated: true,
  });
  
  return user;
}

/**
 * Fetch activity venue maps by city and datetime
 * This tool is accessible to both OpenAI and xAI agents
 */
export async function fetchActivityVenueMaps(
  userId: number,
  datetime: string
): Promise<any[]> {
  const results = await getActivityVenueMapsByCityAndDateTime(userId, datetime);
  
  return results.map((avm) => ({
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
}

/**
 * Get OpenAI function tool definitions for user tools
 */
export function getOpenAITools(): OpenAI.Responses.FunctionTool[] {
  return [
    {
      type: 'function' as const,
      name: 'fetch_user',
      description: 'Fetch user information from database by user ID',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
        },
        required: ['user_id'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'create_user',
      description: 'Create a new user in the database',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
          name: {
            type: 'string',
            description: 'User name',
          },
          bio: {
            type: 'string',
            description: 'User bio',
          },
          locality_id: {
            type: 'number',
            description: 'User locality ID',
          },
          conversation_id: {
            type: 'string',
            description: 'OpenAI conversation ID',
          },
        },
        required: ['user_id'],
        additionalProperties: false,
      },
    },
    {
      type: 'function' as const,
      name: 'update_user',
      description: 'Update user information in the database',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
          name: {
            type: 'string',
            description: 'User name',
          },
          bio: {
            type: 'string',
            description: 'User bio',
          },
          persona_json: {
            type: 'object',
            description: 'User persona JSON',
          },
          short_term_memory_json: {
            type: 'object',
            description: 'Short-term memory JSON (current plan, active agent, conversation context)',
          },
          locality_id: {
            type: 'number',
            description: 'User locality ID',
          },
          conversation_id: {
            type: 'string',
            description: 'OpenAI conversation ID',
          },
        },
        required: ['user_id'],
        additionalProperties: false,
      },
    },
    {
      type: 'function' as const,
      name: 'get_conversation_history',
      description: 'Get the full conversation history for a user',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
        },
        required: ['user_id'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'get_short_term_memory',
      description: 'Get short-term memory (current plan, active agent, conversation context) for a user',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
        },
        required: ['user_id'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'update_short_term_memory',
      description: 'Update short-term memory (current plan, active agent, conversation context) for a user',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
          short_term_memory: {
            type: 'object',
            description: 'Short-term memory object with currentPlan, activeAgent, conversationContext',
          },
        },
        required: ['user_id', 'short_term_memory'],
        additionalProperties: false,
      },
    },
    {
      type: 'function' as const,
      name: 'update_user_persona',
      description: 'Update user persona JSON in the database',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'number',
            description: 'The user ID (contact number)',
          },
          persona_json: {
            type: 'object',
            description: 'User persona JSON object',
          },
        },
        required: ['user_id', 'persona_json'],
        additionalProperties: false,
      },
    },
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
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  args: any,
  userId: number,
  openaiClient?: OpenAI,
  user?: User
): Promise<any> {
  logger.info('Tool Executor: executeTool - Entry', {
    executor: 'executeTool',
    toolName,
    userId,
    args: JSON.stringify(args).substring(0, 500),
    hasOpenAIClient: !!openaiClient,
  });
  
  let result: any;
  
  try {
    switch (toolName) {
      case 'fetch_user':
        result = await fetchUser(args.user_id);
        break;
      
      case 'create_user':
        result = await createUserTool({
          user_id: args.user_id,
          name: args.name,
          bio: args.bio,
          locality_id: args.locality_id,
          conversation_id: args.conversation_id,
        });
        break;
      
      case 'update_user':
        result = await updateUserTool(args.user_id, {
          name: args.name,
          bio: args.bio,
          persona_json: args.persona_json,
          short_term_memory_json: args.short_term_memory_json,
          locality_id: args.locality_id,
          conversation_id: args.conversation_id,
        });
        break;
      
      case 'get_conversation_history':
        if (!openaiClient) {
          throw new Error('OpenAI client required for get_conversation_history');
        }
        result = await getConversationHistory(args.user_id, openaiClient, user);
        break;
      
      case 'update_user_persona':
        result = await updateUserPersona(args.user_id, args.persona_json);
        break;
      
      case 'get_short_term_memory':
        result = await getShortTermMemoryTool(args.user_id);
        break;
      
      case 'update_short_term_memory':
        result = await updateShortTermMemoryTool(args.user_id, args.short_term_memory);
        break;
      
      case 'fetch_activity_venue_maps':
        result = await fetchActivityVenueMaps(userId, args.datetime);
        break;
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    logger.info('Tool Executor: executeTool - Exit (Success)', {
      executor: 'executeTool',
      toolName,
      userId,
      resultType: typeof result,
      resultSize: typeof result === 'string' ? result.length : JSON.stringify(result).length,
      resultPreview: typeof result === 'string' 
        ? result.substring(0, 200) + (result.length > 200 ? '...' : '')
        : JSON.stringify(result).substring(0, 200),
    });
    
    return result;
  } catch (error) {
    logger.error('Tool Executor: executeTool - Exit (Error)', error instanceof Error ? error : new Error(String(error)), {
      executor: 'executeTool',
      toolName,
      userId,
      args: JSON.stringify(args).substring(0, 200),
    });
    throw error;
  }
}
