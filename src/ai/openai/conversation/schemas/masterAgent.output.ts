/**
 * Master Agent Output Schema
 * 
 * Reference schema for Master Agent output
 * 
 * Note: Master Agent now returns a simple string response directly.
 * Memory updates are handled internally by the Master Agent.
 * This schema is kept for reference but Master Agent execution returns string.
 */

export interface MasterAgentOutput {
  response: string; // The message to send to user
  memoryUpdates?: {
    longTerm?: any; // Persona updates (when onboarding completes)
    shortTerm?: {
      activeAgent?: 'onboarding' | 'planning' | 'summary' | null;
      conversationContext?: {
        lastTopic?: string;
        lastIntent?: string;
        [key: string]: any;
      };
      currentPlan?: {
        planId?: string;
        status?: string;
        participants?: number[];
        [key: string]: any;
      };
    };
  };
}
