/**
 * Master Agent Output Schema
 * 
 * Reference schema for Master Agent output
 */

export interface MasterAgentOutput {
  response: string; // The message to send to user
  targetAgent: 'onboarding' | 'planning' | 'out-of-scope' | 'master' | null;
  routingDepth: number; // Current routing depth
  reasoning?: string; // Why routing decision was made
}
