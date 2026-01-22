/**
 * User Tools
 * 
 * Tools accessible to both OpenAI and xAI agents for user and conversation operations
 */

import { getUserById, createUser, updateUser, getUserPersona } from '../../../../db/user';
import { CreateUserInput, User } from '../../../../types/database';
import { getActivityVenueMapsByCityAndDateTime } from '../../../../db/activityVenueMap';
import OpenAI from 'openai';

/**
 * Get user by user ID
 */
export async function fetchUser(userId: number): Promise<User | null> {
  return getUserById(userId);
}

/**
 * Create a new user
 */
export async function createUserTool(userData: {
  user_id: number;
  name?: string;
  bio?: string;
  persona_json?: any;
  locality_id?: number;
  conversation_id?: string;
}): Promise<User> {
  return createUser(userData);
}

/**
 * Update user information
 */
export async function updateUserTool(
  userId: number,
  updates: Partial<CreateUserInput>
): Promise<User> {
  return updateUser(userId, updates);
}

/**
 * Get conversation history for a user
 * Uses OpenAI Conversations API to retrieve full conversation
 */
export async function getConversationHistory(
  userId: number,
  client: OpenAI
): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
  const user = await getUserById(userId);
  
  if (!user || !user.conversation_id) {
    return [];
  }

  const items = await client.conversations.items.list(user.conversation_id, {
    limit: 2000,
    order: 'asc',
  });

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  for await (const item of items) {
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

  return messages;
}

/**
 * Update user persona
 */
export async function updateUserPersona(
  userId: number,
  persona: any
): Promise<User> {
  return updateUser(userId, { persona_json: persona });
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
      strict: true,
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
      strict: true,
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
      strict: true,
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
  openaiClient?: OpenAI
): Promise<any> {
  switch (toolName) {
    case 'fetch_user':
      return await fetchUser(args.user_id);
    
    case 'create_user':
      return await createUserTool({
        user_id: args.user_id,
        name: args.name,
        bio: args.bio,
        locality_id: args.locality_id,
        conversation_id: args.conversation_id,
      });
    
    case 'update_user':
      return await updateUserTool(args.user_id, {
        name: args.name,
        bio: args.bio,
        persona_json: args.persona_json,
        locality_id: args.locality_id,
        conversation_id: args.conversation_id,
      });
    
    case 'get_conversation_history':
      if (!openaiClient) {
        throw new Error('OpenAI client required for get_conversation_history');
      }
      return await getConversationHistory(args.user_id, openaiClient);
    
    case 'update_user_persona':
      return await updateUserPersona(args.user_id, args.persona_json);
    
    case 'fetch_activity_venue_maps':
      return await fetchActivityVenueMaps(userId, args.datetime);
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
