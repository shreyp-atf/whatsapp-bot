/**
 * Out of Scope Agent Input Schema
 * 
 * Reference schema for Out of Scope Agent input
 */

export interface OutOfScopeAgentInput {
  userId: number;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}
