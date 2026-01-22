/**
 * Planning Agent Output Schema
 * 
 * Reference schema for Planning Agent output
 */

export interface PlanningAgentOutput {
  response: string; // The message to send to user
  // Planning Agent doesn't route - Master Agent handles routing
}
