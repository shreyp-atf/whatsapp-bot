/**
 * Error Handling Module
 * 
 * Provides standardized error types, retry logic, and error recovery strategies
 * for agent operations.
 */

/**
 * Standardized error types for agent operations
 */
export enum AgentErrorType {
  VALIDATION = 'VALIDATION',
  EXECUTION = 'EXECUTION',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Agent error class with additional metadata
 */
export class AgentError extends Error {
  public readonly type: AgentErrorType;
  public readonly retryable: boolean;
  public readonly metadata?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    type: AgentErrorType = AgentErrorType.UNKNOWN,
    retryable: boolean = false,
    metadata?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AgentError';
    this.type = type;
    this.retryable = retryable;
    this.metadata = metadata;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentError);
    }
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends AgentError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, AgentErrorType.VALIDATION, false, metadata);
    this.name = 'ValidationError';
  }
}

/**
 * Retry options for operations
 */
export interface RetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  retryable?: (error: Error) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 10000,
  backoffMultiplier: 2,
  retryable: (error: Error) => {
    if (error instanceof AgentError) {
      return error.retryable;
    }
    // Default: retry on network errors, don't retry on validation errors
    return error.message.includes('network') || 
           error.message.includes('timeout') ||
           error.message.includes('rate limit');
  }
};

/**
 * Sleep utility for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let backoffMs = opts.initialBackoffMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!opts.retryable(lastError)) {
        throw lastError;
      }

      // Don't sleep after the last attempt
      if (attempt < opts.maxRetries) {
        await sleep(backoffMs);
        backoffMs = Math.min(
          backoffMs * opts.backoffMultiplier,
          opts.maxBackoffMs
        );
      }
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Classify an error and convert it to an AgentError
 */
export function classifyError(error: unknown): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Classify based on error message patterns
    if (message.includes('validation') || message.includes('invalid')) {
      return new AgentError(
        error.message,
        AgentErrorType.VALIDATION,
        false,
        undefined,
        error
      );
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return new AgentError(
        error.message,
        AgentErrorType.NETWORK,
        true,
        undefined,
        error
      );
    }
    
    if (message.includes('timeout')) {
      return new AgentError(
        error.message,
        AgentErrorType.TIMEOUT,
        true,
        undefined,
        error
      );
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return new AgentError(
        error.message,
        AgentErrorType.RATE_LIMIT,
        true,
        undefined,
        error
      );
    }
    
    if (message.includes('database') || message.includes('sql') || message.includes('query')) {
      return new AgentError(
        error.message,
        AgentErrorType.DATABASE,
        false,
        undefined,
        error
      );
    }

    // Default to execution error
    return new AgentError(
      error.message,
      AgentErrorType.EXECUTION,
      false,
      undefined,
      error
    );
  }

  // Unknown error type
  return new AgentError(
    String(error),
    AgentErrorType.UNKNOWN,
    false
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AgentError) {
    return error.retryable;
  }
  
  const classified = classifyError(error);
  return classified.retryable;
}
