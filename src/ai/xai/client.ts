/**
 * xAI Client Setup
 * 
 * Configures and exports the xAI client for use by agents.
 * Uses @ai-sdk/xai provider with Vercel AI SDK.
 */

import { xai } from '@ai-sdk/xai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Get xAI API key from environment
 */
export function getXaiApiKey(): string {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY is required. Please set it in your .env file.');
  }
  return apiKey;
}

/**
 * Create xAI model instance
 * @param modelName - The Grok model to use (e.g., 'grok-3-beta', 'grok-2-1212')
 */
export function createXaiModel(modelName: string = 'grok-3-beta') {
  // #region debug log
  try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'client.ts:28',message:'Creating xAI model',data:{modelName,usingXaiFunction:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
  // #endregion
  return xai(modelName);
}

/**
 * Create xAI model instance for Responses API (required for web search tools)
 * @param modelName - The Grok model to use (e.g., 'grok-4-fast', 'grok-4-1-fast')
 */
export function createXaiResponsesModel(modelName: string = 'grok-4-fast') {
  // #region debug log
  try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'client.ts:36',message:'Creating xAI responses model',data:{modelName,usingResponsesAPI:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
  // #endregion
  return xai.responses(modelName);
}

/**
 * Default xAI model instance
 */
export const defaultXaiModel = createXaiModel('grok-3-beta');

/**
 * Check if xAI is configured
 */
export function isXaiConfigured(): boolean {
  return !!process.env.XAI_API_KEY;
}
