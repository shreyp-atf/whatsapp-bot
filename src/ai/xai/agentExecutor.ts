/**
 * xAI Agent Executor
 * 
 * Single executor for all agents using xAI SDK.
 * Takes agent definitions from utils/agents and executes them via xAI SDK.
 */

import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createXaiResponsesModel } from './client';
import { xai } from '@ai-sdk/xai';
import {
  AgentOptions,
  AgentResult,
  createSuccessResult,
  createErrorResult
} from '../utils/agentInterface';
import { AgentError, AgentErrorType, classifyError } from '../utils/errorHandling';
import { logger } from '../utils/logging';
import { getAgentDefinition, AgentId } from '../utils/agents/agentDefinitions';

/**
 * Execute an agent using xAI SDK
 * 
 * @param agentId - The ID of the agent to execute
 * @param input - The input for the agent
 * @param options - Execution options
 * @returns Agent execution result
 */
export async function executeAgent<TInput, TOutput>(
  agentId: AgentId,
  input: TInput,
  options?: AgentOptions
): Promise<AgentResult<TOutput>> {
  const startTime = Date.now();
  const enableLogging = options?.enableLogging ?? false;

  try {
    // Get agent definition from registry
    const agentDef = getAgentDefinition(agentId);

    // Validate input
    const validateInput = agentDef.validateInput || ((input: any) => input !== null && input !== undefined);
    if (!validateInput(input)) {
      return createErrorResult(
        new AgentError(
          `Invalid input for agent ${agentDef.name}`,
          AgentErrorType.VALIDATION
        ),
        {
          executionTime: Date.now() - startTime,
          provider: 'xai'
        }
      );
    }

    if (enableLogging) {
      logger.info(`Executing xAI agent: ${agentDef.name}`, {
        agent: agentDef.name,
        agentId,
        provider: 'xai',
        model: options?.model || agentDef.defaultModel || 'grok-4-fast'
      });
    }

    // Use Responses API for web search tools
    const modelName = options?.model || agentDef.defaultModel || 'grok-4-fast';
    const model = createXaiResponsesModel(modelName);
    const userMessage = agentDef.buildUserMessage(input);
    const fullPrompt = `${agentDef.getInstructions()}\n\n${userMessage}`;

    // Setup web search tool
    const webSearchTool = xai.tools.webSearch();

    // Use generateText with web search tools and structured output
    let result;
    try {
      result = await generateText({
        model,
        prompt: fullPrompt,
        tools: {
          web_search: webSearchTool,
        },
        output: Output.object({ schema: agentDef.schema }),
        temperature: options?.temperature ?? 0.7
      });
    } catch (apiError: any) {
      throw apiError;
    }

    // Get structured output directly (already parsed and validated)
    const parsedData = (result as any)._output as TOutput;

    if (enableLogging) {
      logger.info(`LLM Output - ${agentDef.name}`, {
        agent: agentDef.name,
        agentId,
        provider: 'xai',
        model: modelName,
        output: JSON.stringify(parsedData, null, 2),
        tokensUsed: result.usage?.totalTokens,
        usage: result.usage,
        duration: Date.now() - startTime
      });
    }

    if (enableLogging) {
      logger.info(`Completed xAI agent: ${agentDef.name}`, {
        agent: agentDef.name,
        agentId,
        provider: 'xai',
        duration: Date.now() - startTime,
        tokensUsed: result.usage?.totalTokens
      });
    }

    return createSuccessResult(parsedData, {
      executionTime: Date.now() - startTime,
      tokensUsed: result.usage?.totalTokens,
      model: modelName,
      provider: 'xai',
      sources: (result as any).sources || []
    });
  } catch (error) {
    const agentError = classifyError(error);
    
    if (enableLogging) {
      logger.error(`xAI agent failed: ${agentId}`, agentError.originalError || agentError, {
        agentId,
        provider: 'xai'
      });
    }

    return createErrorResult(agentError, {
      executionTime: Date.now() - startTime,
      provider: 'xai'
    });
  }
}

/**
 * Convenience wrapper functions for each agent (for backward compatibility)
 */

export async function executeCityAgent(
  input: { url: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').CityRowSchema>>> {
  return executeAgent('city', input, options);
}

export async function executeCityRegionAgent(
  input: { url: string; city_id: number; city_name: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').CityRegionRowSchema>>> {
  return executeAgent('city-region', input, options);
}

export async function executeLocalityAgent(
  input: { url: string; city_region_id: number; city_region_name: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').LocalityRowSchema>>> {
  return executeAgent('locality', input, options);
}

export async function executeVenueAgent(
  input: { url: string; locality_id: number; locality_name: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').VenueRowSchema>>> {
  return executeAgent('venue', input, options);
}

export async function executeActivityAgent(
  input: { url: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').ActivityRowSchema>>> {
  return executeAgent('activity', input, options);
}

export async function executeActivityVenueMapAgent(
  input: { url: string; activity_id: number; activity_name: string; venue_id: number; venue_name: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').ActivityVenueMapRowSchema>>> {
  return executeAgent('activity-venue-map', input, options);
}

export async function executeEventLinkValidatorAgent(
  input: { url: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').EventLinkValidationSchema>>> {
  return executeAgent('event-link-validator', input, options);
}

export async function executeEventCategoryClassifierAgent(
  input: { url: string; available_categories?: import('../utils/schemas').EventCategory[] },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').EventCategoryClassificationSchema>>> {
  return executeAgent('event-category-classifier', input, options);
}

export async function executeMovieAgent(
  input: { url: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').MovieExtractionSchema>>> {
  return executeAgent('movie', input, options);
}

export async function executeGokartingAgent(
  input: { url: string },
  options?: AgentOptions
): Promise<AgentResult<z.infer<typeof import('../utils/schemas').GokartingExtractionSchema>>> {
  return executeAgent('gokarting', input, options);
}
