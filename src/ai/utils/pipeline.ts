/**
 * Pipeline Orchestration Class
 * 
 * Provides sequential agent execution with error propagation and rollback support.
 * Used for chaining multiple agents together (e.g., city → city_region → locality → venue).
 */

import { AgentError, AgentErrorType } from './errorHandling';
import { logger, LogMetadata } from './logging';

/**
 * Pipeline context passed between steps
 */
export interface PipelineContext {
  [key: string]: any;
  stepIndex?: number;
  stepName?: string;
  startTime?: number;
}

/**
 * Pipeline step definition
 */
export interface PipelineStep<TInput, TOutput> {
  name: string;
  executor: (input: TInput, context: PipelineContext) => Promise<TOutput>;
  onError?: (error: Error, context: PipelineContext) => Promise<void>;
  rollback?: (context: PipelineContext) => Promise<void>;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult<TFinalOutput = any> {
  success: boolean;
  data?: TFinalOutput;
  error?: AgentError;
  stepResults: Array<{
    stepName: string;
    success: boolean;
    data?: any;
    error?: Error;
    duration: number;
  }>;
  totalDuration: number;
}

/**
 * Pipeline class for sequential agent execution
 */
export class Pipeline {
  private steps: PipelineStep<any, any>[] = [];
  private errorHandler?: (step: string, error: Error, context: PipelineContext) => Promise<void>;
  private enableLogging: boolean = false;

  /**
   * Add a step to the pipeline
   */
  addStep<TInput, TOutput>(
    name: string,
    executor: (input: TInput, context: PipelineContext) => Promise<TOutput>,
    options?: {
      onError?: (error: Error, context: PipelineContext) => Promise<void>;
      rollback?: (context: PipelineContext) => Promise<void>;
    }
  ): Pipeline {
    this.steps.push({
      name,
      executor,
      onError: options?.onError,
      rollback: options?.rollback
    });
    return this;
  }

  /**
   * Set global error handler for all steps
   */
  onStepError(
    handler: (step: string, error: Error, context: PipelineContext) => Promise<void>
  ): Pipeline {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Enable logging for pipeline execution
   */
  enableLoggingMode(enabled: boolean = true): Pipeline {
    this.enableLogging = enabled;
    return this;
  }

  /**
   * Execute the pipeline with initial input
   */
  async execute<TInitialInput, TFinalOutput = any>(
    initialInput: TInitialInput
  ): Promise<PipelineResult<TFinalOutput>> {
    const startTime = Date.now();
    const context: PipelineContext = {
      startTime,
      initialInput
    };
    const stepResults: PipelineResult['stepResults'] = [];

    let currentInput: any = initialInput;
    let currentStepIndex = 0;

    try {
      for (const step of this.steps) {
        const stepStartTime = Date.now();
        currentStepIndex++;
        context.stepIndex = currentStepIndex;
        context.stepName = step.name;

        if (this.enableLogging) {
          logger.info(`Executing pipeline step: ${step.name}`, {
            stepIndex: currentStepIndex,
            totalSteps: this.steps.length
          });
        }

        try {
          // Execute step
          const stepResult = await step.executor(currentInput, context);
          const stepDuration = Date.now() - stepStartTime;

          // Store result in context for next steps
          context[step.name] = stepResult;
          currentInput = stepResult;

          stepResults.push({
            stepName: step.name,
            success: true,
            data: stepResult,
            duration: stepDuration
          });

          if (this.enableLogging) {
            logger.info(`Completed pipeline step: ${step.name}`, {
              stepIndex: currentStepIndex,
              duration: stepDuration
            });
          }
        } catch (error) {
          const stepDuration = Date.now() - stepStartTime;
          const stepError = error instanceof Error ? error : new Error(String(error));

          stepResults.push({
            stepName: step.name,
            success: false,
            error: stepError,
            duration: stepDuration
          });

          // Call step-specific error handler if available
          if (step.onError) {
            try {
              await step.onError(stepError, context);
            } catch (handlerError) {
              logger.error(
                `Error handler failed for step: ${step.name}`,
                handlerError instanceof Error ? handlerError : new Error(String(handlerError))
              );
            }
          }

          // Call global error handler if available
          if (this.errorHandler) {
            try {
              await this.errorHandler(step.name, stepError, context);
            } catch (handlerError) {
              logger.error(
                `Global error handler failed for step: ${step.name}`,
                handlerError instanceof Error ? handlerError : new Error(String(handlerError))
              );
            }
          }

          // Perform rollback for completed steps (in reverse order)
          for (let i = stepResults.length - 2; i >= 0; i--) {
            const completedStep = this.steps[i];
            if (completedStep.rollback) {
              try {
                await completedStep.rollback(context);
                if (this.enableLogging) {
                  logger.info(`Rolled back step: ${completedStep.name}`);
                }
              } catch (rollbackError) {
                logger.error(
                  `Rollback failed for step: ${completedStep.name}`,
                  rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError))
                );
              }
            }
          }

          // Convert error to AgentError
          const agentError = stepError instanceof AgentError
            ? stepError
            : new AgentError(
                `Pipeline step "${step.name}" failed: ${stepError.message}`,
                AgentErrorType.EXECUTION,
                false,
                { stepName: step.name, stepIndex: currentStepIndex },
                stepError
              );

          return {
            success: false,
            error: agentError,
            stepResults,
            totalDuration: Date.now() - startTime
          };
        }
      }

      // All steps completed successfully
      const totalDuration = Date.now() - startTime;
      
      if (this.enableLogging) {
        logger.info('Pipeline execution completed successfully', {
          totalSteps: this.steps.length,
          totalDuration
        });
      }

      return {
        success: true,
        data: currentInput as TFinalOutput,
        stepResults,
        totalDuration
      };
    } catch (error) {
      const agentError = error instanceof AgentError
        ? error
        : new AgentError(
            'Pipeline execution failed',
            AgentErrorType.EXECUTION,
            false,
            undefined,
            error instanceof Error ? error : new Error(String(error))
          );

      return {
        success: false,
        error: agentError,
        stepResults,
        totalDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Get the number of steps in the pipeline
   */
  getStepCount(): number {
    return this.steps.length;
  }

  /**
   * Get step names
   */
  getStepNames(): string[] {
    return this.steps.map(step => step.name);
  }
}

/**
 * Create a URL processing pipeline for xAI agents
 */
export function createUrlProcessingPipeline(): Pipeline {
  return new Pipeline();
}
