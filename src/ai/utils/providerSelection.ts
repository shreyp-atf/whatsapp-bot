/**
 * Provider Selection and Fallback Logic
 * 
 * Handles provider selection and automatic fallback to OpenAI on connection/auth errors.
 */

import { logger } from './logging';
import { AgentError, AgentErrorType } from './errorHandling';

export type Provider = 'xai' | 'openai';

export interface ProviderConfig {
  provider: Provider;
  fallbackToOpenAI: boolean;
}

/**
 * Check if an error is a connection/auth error that should trigger fallback
 */
function isConnectionError(error: any): boolean {
  if (!error) return false;
  
  // Check for common connection/auth error patterns
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code || '';
  const statusCode = error.statusCode || error.status;
  
  // API key errors
  if (errorMessage.includes('api key') || errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
    return true;
  }
  
  // Connection errors
  if (errorMessage.includes('connection') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return true;
  }
  
  // HTTP status codes
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    return true;
  }
  
  // Error codes
  if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND') {
    return true;
  }
  
  return false;
}

/**
 * Execute an operation with automatic fallback to OpenAI on connection/auth errors
 */
export async function executeWithProviderFallback<T>(
  operation: (provider: Provider) => Promise<T>,
  preferredProvider: Provider,
  options?: { enableLogging?: boolean }
): Promise<{ result: T; provider: Provider }> {
  const { enableLogging = false } = options || {};
  
  // If already using OpenAI, no fallback needed
  if (preferredProvider === 'openai') {
    try {
      const result = await operation('openai');
      return { result, provider: 'openai' };
    } catch (error) {
      logger.error('OpenAI operation failed', error instanceof Error ? error : new Error(String(error)), {
        provider: 'openai',
        enableLogging
      });
      throw error;
    }
  }
  
  // Try preferred provider (xAI) first
  try {
    if (enableLogging) {
      logger.info(`Attempting operation with ${preferredProvider}`, { provider: preferredProvider });
    }
    
    const result = await operation(preferredProvider);
    
    if (enableLogging) {
      logger.info(`Operation succeeded with ${preferredProvider}`, { provider: preferredProvider });
    }
    
    return { result, provider: preferredProvider };
  } catch (error) {
    // Check if this is a connection/auth error
    if (isConnectionError(error)) {
      if (enableLogging) {
        logger.warn(`Connection/auth error with ${preferredProvider}, falling back to OpenAI`, {
          provider: preferredProvider,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Fallback to OpenAI
      try {
        if (enableLogging) {
          logger.info('Attempting operation with OpenAI fallback', { provider: 'openai' });
        }
        
        const result = await operation('openai');
        
        if (enableLogging) {
          logger.info('Operation succeeded with OpenAI fallback', { provider: 'openai' });
        }
        
        return { result, provider: 'openai' };
      } catch (fallbackError) {
        logger.error('Both providers failed', fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)), {
          preferredProvider,
          fallbackProvider: 'openai',
          enableLogging
        });
        throw fallbackError;
      }
    } else {
      // Not a connection error, don't fallback - throw original error
      logger.error(`Operation failed with ${preferredProvider} (non-connection error)`, error instanceof Error ? error : new Error(String(error)), {
        provider: preferredProvider,
        enableLogging
      });
      throw error;
    }
  }
}

/**
 * Validate required environment variables for providers
 */
export function validateProviderEnvVars(provider: Provider): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  // OpenAI is always required (as fallback)
  if (!process.env.OPENAI_API_KEY) {
    missing.push('OPENAI_API_KEY');
  }
  
  // xAI only required if using xAI
  if (provider === 'xai' && !process.env.XAI_API_KEY) {
    missing.push('XAI_API_KEY');
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}
