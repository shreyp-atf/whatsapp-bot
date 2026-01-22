/**
 * Out of Scope Agent Output Schema
 * 
 * Reference schema for Out of Scope Agent output
 */

export interface OutOfScopeAgentOutput {
  response: string; // The message to send to user
  // Out of Scope Agent doesn't route - Master Agent handles routing
}
