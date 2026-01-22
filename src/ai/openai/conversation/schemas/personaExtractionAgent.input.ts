/**
 * Persona Extraction Agent Input Schema
 * 
 * Reference schema for Persona Extraction Agent input
 */

export interface PersonaExtractionAgentInput {
  userId: number;
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}
