/**
 * Agent Execution Interface
 * 
 * Defines provider-agnostic interfaces for agent execution.
 * Both OpenAI and xAI agents implement these interfaces.
 */

import { z } from "zod";
import { AgentError, AgentErrorType } from "./errorHandling";
import { LogMetadata } from "./logging";

/**
 * Agent execution options
 */
export interface AgentOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableLogging?: boolean;
  metadata?: LogMetadata;
}

/**
 * Agent execution result metadata
 */
export interface AgentResultMetadata {
  executionTime: number;
  tokensUsed?: number;
  model?: string;
  provider?: 'openai' | 'xai';
  sources?: any[];
  [key: string]: any;
}

/**
 * Agent execution result
 */
export interface AgentResult<TOutput> {
  success: boolean;
  data?: TOutput;
  error?: AgentError;
  metadata?: AgentResultMetadata;
}

/**
 * Agent executor interface
 * 
 * All agents (OpenAI and xAI) should implement this interface
 */
export interface AgentExecutor<TInput, TOutput> {
  /**
   * Execute the agent with given input
   */
  execute(input: TInput, options?: AgentOptions): Promise<AgentResult<TOutput>>;

  /**
   * Validate input before execution
   */
  validateInput(input: TInput): boolean;

  /**
   * Get the Zod schema for the output
   */
  getSchema(): z.ZodSchema<TOutput>;

  /**
   * Get the agent name
   */
  getName(): string;
}

/**
 * Helper function to create a successful agent result
 */
export function createSuccessResult<TOutput>(
  data: TOutput,
  metadata?: AgentResultMetadata
): AgentResult<TOutput> {
  return {
    success: true,
    data,
    metadata
  };
}

/**
 * Helper function to create a failed agent result
 */
export function createErrorResult<TOutput>(
  error: AgentError | Error | string,
  metadata?: AgentResultMetadata
): AgentResult<TOutput> {
  const agentError = error instanceof AgentError
    ? error
    : error instanceof Error
    ? new AgentError(error.message, AgentErrorType.EXECUTION, false, undefined, error)
    : new AgentError(error, AgentErrorType.EXECUTION);

  return {
    success: false,
    error: agentError,
    metadata
  };
}

/**
 * Helper function to wrap agent execution with error handling and logging
 */
export async function executeAgent<TInput, TOutput>(
  executor: AgentExecutor<TInput, TOutput>,
  input: TInput,
  options?: AgentOptions
): Promise<AgentResult<TOutput>> {
  const startTime = Date.now();
  const agentName = executor.getName();

  try {
    // Validate input
    if (!executor.validateInput(input)) {
      return createErrorResult(
        new AgentError(
          `Invalid input for agent ${agentName}`,
          AgentErrorType.VALIDATION
        ),
        {
          executionTime: Date.now() - startTime,
          provider: options?.metadata?.provider
        }
      );
    }

    // Execute agent
    const result = await executor.execute(input, options);

    // Add execution time if not present
    if (result.metadata) {
      result.metadata.executionTime = Date.now() - startTime;
    } else {
      result.metadata = {
        executionTime: Date.now() - startTime,
        provider: options?.metadata?.provider
      };
    }

    return result;
  } catch (error) {
    const agentError = error instanceof AgentError ? error :
      new AgentError(error instanceof Error ? error.message : String(error), AgentErrorType.EXECUTION);

    return createErrorResult(
      agentError,
      {
        executionTime: Date.now() - startTime,
        provider: options?.metadata?.provider
      }
    );
  }
}
