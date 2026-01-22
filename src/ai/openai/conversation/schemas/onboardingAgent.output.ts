/**
 * Onboarding Agent Output Schema
 * 
 * Reference schema for Onboarding Agent output
 */

export interface OnboardingAgentOutput {
  response: string; // The message to send to user
  onboardingComplete: boolean; // Whether onboarding is complete
  userUpdates?: {
    name?: string;
    bio?: string;
    locality_id?: number;
    [key: string]: any;
  };
}
