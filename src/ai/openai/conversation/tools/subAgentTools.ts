/**
 * Sub-Agent Tools
 * 
 * Restricted tool set for sub-agents (Onboarding, Planning, Summary)
 * Sub-agents can only read/update data - they CANNOT send responses to users
 * Only Master Agent can send responses
 */

import OpenAI from 'openai';
import { getOpenAITools } from './userTools';

/**
 * Get restricted tools for sub-agents
 * 
 * SECURITY: Sub-agents can only perform data operations - they CANNOT send responses to users.
 * Only Master Agent can send responses. This ensures all user communication goes through
 * Master Agent, which repackages sub-agent responses appropriately.
 * 
 * Sub-agents can only:
 * - Read user data (fetch_user, get_short_term_memory)
 * - Update user data (update_user, update_short_term_memory, update_user_persona)
 * - Create users (create_user) - for onboarding
 * - Fetch activity data (fetch_activity_venue_maps)
 * 
 * NOTE: Sub-agents do NOT have access to get_conversation_history because:
 * - They maintain their own conversations in agent_conversation_ids
 * - Conversation history is automatically available in their conversation context
 * - get_conversation_history uses user.conversation_id (Master Agent's conversation)
 * 
 * Sub-agents CANNOT:
 * - Send messages to users (no sendMessage tools exist, but this ensures they can't be added)
 * - Directly respond to users (responses go through Master Agent)
 * - Access any response-sending capabilities
 * 
 * Master Agent uses getOpenAITools() directly for full access.
 */
export function getSubAgentTools(): OpenAI.Responses.FunctionTool[] {
  const allTools = getOpenAITools();
  
  // Explicitly whitelist only data operation tools
  // This prevents any future response-sending tools from being accidentally exposed to sub-agents
  const allowedToolNames = [
    'fetch_user',
    'create_user',
    'update_user',
    // 'get_conversation_history' - Removed: sub-agents use their own conversations
    'get_short_term_memory',
    'update_short_term_memory',
    'update_user_persona',
    'fetch_activity_venue_maps',
  ];
  
  return allTools.filter(tool => 
    tool.type === 'function' && 
    allowedToolNames.includes(tool.name)
  );
}
