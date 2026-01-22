/**
 * Planning Agent Input Schema
 * 
 * Reference schema for Planning Agent input
 */

export interface PlanningAgentInput {
  userId: number;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}
