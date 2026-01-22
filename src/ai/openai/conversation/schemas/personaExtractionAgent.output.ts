/**
 * Persona Extraction Agent Output Schema
 * 
 * Reference schema for Persona Extraction Agent output
 */

export interface PersonaExtractionAgentOutput {
  persona: {
    preferences?: string[];
    interests?: string[];
    communication_style?: string;
    behavior_patterns?: string[];
    location_preferences?: string[];
    activity_preferences?: string[];
    [key: string]: any;
  };
  summary: string; // Summary of the conversation
}
