/**
 * Logging Abstraction
 * 
 * Provides consistent logging interface with tracing and performance metrics
 * for agent operations. Works with both OpenAI and xAI agents.
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Log metadata
 */
export interface LogMetadata {
  [key: string]: any;
  timestamp?: string;
  operation?: string;
  duration?: number;
  agent?: string;
  provider?: 'openai' | 'xai';
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, error?: Error, metadata?: LogMetadata): void;
  trace<T>(operation: string, fn: () => Promise<T>, metadata?: LogMetadata): Promise<T>;
}

/**
 * Default logger implementation using console
 */
class ConsoleLogger implements Logger {
  constructor(private category: string = 'app') {}

  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    return `[${timestamp}] [${this.category}] [${level}] ${message}${metaStr}`;
  }

  debug(message: string, metadata?: LogMetadata): void {
    console.debug(this.formatMessage(LogLevel.DEBUG, message, metadata));
  }

  info(message: string, metadata?: LogMetadata): void {
    console.log(this.formatMessage(LogLevel.INFO, message, metadata));
  }

  warn(message: string, metadata?: LogMetadata): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, metadata));
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    const errorMetadata = error ? {
      ...metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : metadata;
    console.error(this.formatMessage(LogLevel.ERROR, message, errorMetadata));
  }

  async trace<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> {
    const startTime = Date.now();
    const traceMetadata: LogMetadata = {
      ...metadata,
      operation,
      timestamp: new Date().toISOString()
    };

    try {
      this.debug(`Starting operation: ${operation}`, traceMetadata);
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`Completed operation: ${operation}`, {
        ...traceMetadata,
        duration,
        success: true
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      this.error(`Failed operation: ${operation}`, err, {
        ...traceMetadata,
        duration,
        success: false
      });
      throw error;
    }
  }
}

/**
 * Singleton logger instance
 */
let loggerInstance: Logger | null = null;

/**
 * Get or create the logger instance
 */
export function getLogger(category?: string): Logger {
  if (!loggerInstance) {
    loggerInstance = new ConsoleLogger(category || 'app');
  }
  return loggerInstance;
}

/**
 * Set a custom logger instance
 */
export function setLogger(customLogger: Logger): void {
  loggerInstance = customLogger;
}

/**
 * Create a logger with default metadata
 */
export function createLoggerWithMetadata(defaultMetadata: LogMetadata): Logger {
  const baseLogger = getLogger();
  
  return {
    debug: (message: string, metadata?: LogMetadata) => {
      baseLogger.debug(message, { ...defaultMetadata, ...metadata });
    },
    info: (message: string, metadata?: LogMetadata) => {
      baseLogger.info(message, { ...defaultMetadata, ...metadata });
    },
    warn: (message: string, metadata?: LogMetadata) => {
      baseLogger.warn(message, { ...defaultMetadata, ...metadata });
    },
    error: (message: string, error?: Error, metadata?: LogMetadata) => {
      baseLogger.error(message, error, { ...defaultMetadata, ...metadata });
    },
    trace: async <T>(
      operation: string,
      fn: () => Promise<T>,
      metadata?: LogMetadata
    ): Promise<T> => {
      return baseLogger.trace(operation, fn, { ...defaultMetadata, ...metadata });
    }
  };
}

/**
 * Export default logger for convenience
 */
export const logger = getLogger();

/**
 * Create a logger with a specific category
 */
export function createLogger(category: string): Logger {
  return new ConsoleLogger(category);
}

/**
 * Export xAI-specific logger
 */
export const xaiAgentLogger = createLogger('xai-agent');
