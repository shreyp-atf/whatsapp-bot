/**
 * OpenAI Agents Orchestrator
 *
 * This module provides the main orchestration for OpenAI-based URL processing pipeline.
 * It wraps the provider-agnostic workflow with OpenAI-specific configuration.
 */

import { runUrlProcessingPipeline as runWorkflow } from '../workflows';
import type { UrlProcessingResult } from '../workflows';

/**
 * Run the complete URL processing pipeline using OpenAI agents
 * This is a wrapper around the provider-agnostic workflow
 */
export async function runUrlProcessingPipeline(
  url: string,
  options: {
    enableLogging?: boolean;
    enableTracing?: boolean;
    maxRetries?: number;
  } = {}
): Promise<UrlProcessingResult> {
  return runWorkflow(url, 'openai', options);
}

// Re-export the result type
export type { UrlProcessingResult } from '../workflows';
