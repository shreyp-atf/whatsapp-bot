/**
 * OpenAI Agent Executor
 * 
 * Single executor for all agents using OpenAI SDK.
 * Takes agent definitions from utils/agents and executes them via OpenAI SDK.
 */

import { webSearchTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { z } from 'zod';
import {
  AgentOptions,
  AgentResult,
  createSuccessResult,
  createErrorResult
} from '../utils/agentInterface';
import { AgentError, AgentErrorType, classifyError } from '../utils/errorHandling';
import { logger } from '../utils/logging';
import { getAgentDefinition, AgentId } from '../utils/agents/agentDefinitions';

// Tool definitions
const webSearchPreview = webSearchTool({
  searchContextSize: "medium",
  userLocation: {
    city: "Gurugram",
    country: "IN",
    region: "Haryana",
    type: "approximate"
  }
});

/**
 * Execute an agent using OpenAI SDK
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
          provider: 'openai'
        }
      );
    }

    // Determine model name: ignore xAI models from agentDef.defaultModel, use OpenAI models only
    const getOpenAIModel = (): string => {
      if (options?.model) {
        return options.model;
      }
      // Ignore xAI models (grok-*) from agentDef.defaultModel
      if (agentDef.defaultModel && !agentDef.defaultModel.startsWith('grok-')) {
        return agentDef.defaultModel;
      }
      // Default to OpenAI model (ignore xAI models)
      return 'gpt-5-nano'; // Using gpt-5-nano as the default OpenAI model
    };
    
    const modelName = getOpenAIModel();

    if (enableLogging) {
      logger.info(`Executing OpenAI agent: ${agentDef.name}`, {
        agent: agentDef.name,
        agentId,
        provider: 'openai',
        model: modelName
      });
    }

    // Create the agent with web search capabilities
    const agent = new Agent({
      name: agentDef.name,
      instructions: agentDef.getInstructions(),
      model: modelName,
      tools: [
        webSearchPreview
      ],
      outputType: agentDef.schema,
      modelSettings: {
        reasoning: {
          effort: "low"
        },
        store: true
      }
    });

    // Build conversation history
    const userMessage = agentDef.buildUserMessage(input);
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [{
          type: "input_text",
          text: userMessage
        }]
      }
    ];

    // Execute agent with tracing
    const result = await withTrace(`OpenAI Agent: ${agentDef.name}`, async () => {
      const runner = new Runner({
        traceMetadata: {
          __trace_source__: agentId,
          agent_name: agentDef.name,
          timestamp: new Date().toISOString()
        }
      });

      const runResult = await runner.run(agent, conversationHistory);

      if (!runResult.finalOutput) {
        throw new Error("Agent result is undefined");
      }

      return runResult.finalOutput;
    });

    // Parse and validate output
    const parsedData = agentDef.schema.parse(result) as TOutput;

    if (enableLogging) {
      logger.info(`LLM Output - ${agentDef.name}`, {
        agent: agentDef.name,
        agentId,
        provider: 'openai',
        model: modelName,
        output: JSON.stringify(parsedData, null, 2),
        duration: Date.now() - startTime
      });
    }

    if (enableLogging) {
      logger.info(`Completed OpenAI agent: ${agentDef.name}`, {
        agent: agentDef.name,
        agentId,
        provider: 'openai',
        duration: Date.now() - startTime
      });
    }

    return createSuccessResult(parsedData, {
      executionTime: Date.now() - startTime,
      model: modelName,
      provider: 'openai'
    });
  } catch (error) {
    const agentError = classifyError(error);
    
    if (enableLogging) {
      logger.error(`OpenAI agent failed: ${agentId}`, agentError.originalError || agentError, {
        agentId,
        provider: 'openai'
      });
    }

    return createErrorResult(agentError, {
      executionTime: Date.now() - startTime,
      provider: 'openai'
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
