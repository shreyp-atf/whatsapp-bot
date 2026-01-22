/**
 * Onboarding Agent Input Schema
 * 
 * Reference schema for Onboarding Agent input
 */

export interface OnboardingAgentInput {
  userId: number;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}
