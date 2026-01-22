/**
 * Master Agent Input Schema
 * 
 * Reference schema for Master Agent input
 */

export interface MasterAgentInput {
  userId: number;
  message: string;
  routingDepth?: number; // Current routing depth (default: 0)
}
