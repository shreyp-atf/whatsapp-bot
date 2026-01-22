/**
 * Transaction Wrapper
 * 
 * Provides centralized transaction management for agent operations.
 * Wraps agent execution and database operations in database transactions.
 */

import { PoolClient } from 'pg';
import { withTransaction } from '../../db/connection';
import { AgentError, AgentErrorType, withRetry } from './errorHandling';
import { logger } from './logging';
import { AgentExecutor, AgentOptions, AgentResult, executeAgent } from './agentInterface';

/**
 * Options for transaction wrapper
 */
export interface TransactionOptions {
  enableLogging?: boolean;
  retryOnError?: boolean;
  retryOptions?: {
    maxRetries?: number;
    initialBackoffMs?: number;
  };
}

/**
 * Execute an operation within a database transaction
 */
export async function withAgentTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const { enableLogging = false, retryOnError = false, retryOptions } = options;

  const executeOperation = async (): Promise<T> => {
    return await withTransaction(async (client) => {
      if (enableLogging) {
        logger.debug('Starting database transaction');
      }

      try {
        const result = await operation(client);
        
        if (enableLogging) {
          logger.debug('Transaction completed successfully');
        }
        
        return result;
      } catch (error) {
        if (enableLogging) {
          logger.error('Transaction failed, rolling back', error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
      }
    });
  };

  if (retryOnError) {
    return await withRetry(executeOperation, retryOptions);
  }

  return await executeOperation();
}

/**
 * Execute an agent and perform database operations within a transaction
 * 
 * @param agent - The agent executor
 * @param input - Agent input
 * @param dbOperations - Function to perform database operations with agent result and transaction client
 * @param options - Agent and transaction options
 */
export async function executeAgentWithTransaction<TInput, TOutput, TDbResult>(
  agent: AgentExecutor<TInput, TOutput>,
  input: TInput,
  dbOperations: (agentResult: TOutput, client: PoolClient) => Promise<TDbResult>,
  options?: AgentOptions & TransactionOptions
): Promise<AgentResult<TDbResult>> {
  const {
    enableLogging = false,
    retryOnError = false,
    retryOptions,
    ...agentOptions
  } = options || {};

  const startTime = Date.now();

  try {
    // Execute agent first (outside transaction)
    if (enableLogging) {
      logger.info(`Executing agent: ${agent.getName()}`);
    }

    const agentResult = await executeAgent(agent, input, {
      ...agentOptions,
      enableLogging,
      metadata: {
        ...agentOptions.metadata,
        provider: agentOptions.metadata?.provider || 'openai' // Default to openai, will be overridden by actual provider
      }
    });

    if (!agentResult.success || !agentResult.data) {
      // Agent failed, return error result
      return {
        success: false,
        error: agentResult.error || new AgentError('Agent execution failed', AgentErrorType.EXECUTION),
        metadata: {
          executionTime: Date.now() - startTime,
          ...agentResult.metadata
        }
      };
    }

    // Agent succeeded, perform database operations in transaction
    if (enableLogging) {
      logger.info('Performing database operations in transaction');
    }

    const executeDbOps = async (): Promise<TDbResult> => {
      return await withTransaction(async (client) => {
        try {
          const dbResult = await dbOperations(agentResult.data!, client);
          
          if (enableLogging) {
            logger.info('Database operations completed successfully');
          }
          
          return dbResult;
        } catch (error) {
          if (enableLogging) {
            logger.error('Database operations failed, rolling back', error instanceof Error ? error : new Error(String(error)));
          }
          throw error;
        }
      });
    };

    const dbResult = retryOnError
      ? await withRetry(executeDbOps, retryOptions)
      : await executeDbOps();

    return {
      success: true,
      data: dbResult,
      metadata: {
        executionTime: Date.now() - startTime,
        ...agentResult.metadata
      }
    };
  } catch (error) {
    const agentError = error instanceof AgentError
      ? error
      : new AgentError(
          'Agent transaction execution failed',
          AgentErrorType.EXECUTION,
          false,
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );

    logger.error('Agent transaction execution failed', agentError.originalError || agentError, {
      agent: agent.getName(),
      enableLogging
    });

    return {
      success: false,
      error: agentError,
      metadata: {
        executionTime: Date.now() - startTime
      }
    };
  }
}

/**
 * Execute multiple database operations within a single transaction
 * 
 * @param operations - Array of operations to execute sequentially
 * @param options - Transaction options
 */
export async function executeMultipleOperations<TResults extends any[]>(
  operations: Array<(client: PoolClient) => Promise<any>>,
  options: TransactionOptions = {}
): Promise<TResults> {
  const { enableLogging = false } = options;

  return await withTransaction(async (client) => {
    const results: any[] = [];

    for (let i = 0; i < operations.length; i++) {
      if (enableLogging) {
        logger.debug(`Executing operation ${i + 1}/${operations.length}`);
      }

      try {
        const result = await operations[i](client);
        results.push(result);
      } catch (error) {
        if (enableLogging) {
          logger.error(`Operation ${i + 1} failed`, error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
      }
    }

    return results as TResults;
  });
}
