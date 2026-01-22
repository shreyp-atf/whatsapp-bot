/**
 * Base xAI Agent Helper
 * 
 * Provides common functionality for xAI agents using Vercel AI SDK.
 * Wraps Vercel AI SDK calls to implement the AgentExecutor interface.
 */

import { generateObject, generateText, Output } from 'ai';
import { z } from 'zod';
import { createXaiModel, createXaiResponsesModel } from './client';
import { xai } from '@ai-sdk/xai';
import {
  AgentExecutor,
  AgentOptions,
  AgentResult,
  createSuccessResult,
  createErrorResult
} from '../utils/agentInterface';
import { AgentError, AgentErrorType, classifyError } from '../utils/errorHandling';
import { logger } from '../utils/logging';

/**
 * Base xAI agent implementation
 */
export abstract class BaseXaiAgent<TInput, TOutput> implements AgentExecutor<TInput, TOutput> {
  protected modelName: string;
  protected schema: z.ZodSchema<TOutput>;
  protected agentName: string;

  constructor(
    agentName: string,
    schema: z.ZodSchema<TOutput>,
    modelName: string = 'grok-4-fast' // Use grok-4-fast for web search capabilities (Responses API)
  ) {
    this.agentName = agentName;
    this.schema = schema;
    this.modelName = modelName;
  }

  abstract getName(): string;
  abstract getInstructions(): string;
  abstract buildUserMessage(input: TInput): string;

  getSchema(): z.ZodSchema<TOutput> {
    return this.schema;
  }

  validateInput(input: TInput): boolean {
    // Basic validation - can be overridden
    return input !== null && input !== undefined;
  }

  async execute(input: TInput, options?: AgentOptions): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    const enableLogging = options?.enableLogging ?? false;

    try {
      if (!this.validateInput(input)) {
        return createErrorResult(
          new AgentError(
            `Invalid input for agent ${this.getName()}`,
            AgentErrorType.VALIDATION
          ),
          {
            executionTime: Date.now() - startTime,
            provider: 'xai'
          }
        );
      }

      if (enableLogging) {
        logger.info(`Executing xAI agent: ${this.getName()}`, {
          agent: this.getName(),
          provider: 'xai',
          model: this.modelName
        });
      }

      // Use Responses API for web search tools
      const model = createXaiResponsesModel(this.modelName);
      const userMessage = this.buildUserMessage(input);
      const fullPrompt = `${this.getInstructions()}\n\n${userMessage}`;

      // #region debug log
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'baseAgent.ts:79',message:'Model creation',data:{modelName:this.modelName,modelType:model?.constructor?.name,hasModel:!!model,usingResponsesAPI:true},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
      // #endregion

      // #region debug log
      const webSearchTool = xai.tools.webSearch();
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'baseAgent.ts:100',message:'Tool configuration',data:{toolType:webSearchTool?.constructor?.name,hasTool:!!webSearchTool,modelName:this.modelName},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
      // #endregion

      // #region debug log
      const requestConfig = {
        hasModel: !!model,
        modelType: model?.constructor?.name,
        hasTools: !!webSearchTool,
        toolType: webSearchTool?.constructor?.name,
        promptLength: fullPrompt.length,
        temperature: options?.temperature ?? 0.7,
        usingResponsesAPI: true
      };
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'baseAgent.ts:108',message:'Before generateText call',data:requestConfig,timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
      // #endregion

      // Use generateText with web search tools and structured output
      let result;
      try {
        // #region debug log
        try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'baseAgent.ts:121',message:'Calling generateText with structured output',data:{hasSchema:!!this.schema,usingOutputObject:true},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
        // #endregion
        
        result = await generateText({
          model,
          prompt: fullPrompt,
          tools: {
            web_search: webSearchTool,
          },
          output: Output.object({ schema: this.schema }),
          temperature: options?.temperature ?? 0.7
        });
        
        // #region debug log
        try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'baseAgent.ts:133',message:'generateText succeeded',data:{hasResult:!!result,hasOutput:!!(result as any)._output,hasText:!!result?.text},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
        // #endregion
      } catch (apiError: any) {
        // #region debug log
        try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'baseAgent.ts:137',message:'generateText API error',data:{errorName:apiError?.name,errorMessage:apiError?.message,errorStack:apiError?.stack?.substring(0,500),modelName:this.modelName,modelType:model?.constructor?.name,usingResponsesAPI:true},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
        // #endregion
        throw apiError;
      }

      // Get structured output directly (already parsed and validated)
      const parsedData = (result as any)._output as TOutput;
      
      // #region debug log
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'baseAgent.ts:145',message:'Structured output extracted',data:{hasParsedData:!!parsedData,parsedKeys:Object.keys(parsedData||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix'})+'\n');}catch(e){}
      // #endregion

      if (enableLogging) {
        logger.info(`LLM Output - ${this.getName()}`, {
          agent: this.getName(),
          provider: 'xai',
          model: this.modelName,
          output: JSON.stringify(parsedData, null, 2),
          tokensUsed: result.usage?.totalTokens,
          usage: result.usage,
          duration: Date.now() - startTime
        });
      }

      if (enableLogging) {
        logger.info(`Completed xAI agent: ${this.getName()}`, {
          agent: this.getName(),
          provider: 'xai',
          duration: Date.now() - startTime,
          tokensUsed: result.usage?.totalTokens
        });
      }

      return createSuccessResult(parsedData, {
        executionTime: Date.now() - startTime,
        tokensUsed: result.usage?.totalTokens,
        model: this.modelName,
        provider: 'xai',
        sources: (result as any).sources || []
      });
    } catch (error) {
      const agentError = classifyError(error);
      
      if (enableLogging) {
        logger.error(`xAI agent failed: ${this.getName()}`, agentError.originalError || agentError, {
          agent: this.getName(),
          provider: 'xai'
        });
      }

      return createErrorResult(agentError, {
        executionTime: Date.now() - startTime,
        provider: 'xai'
      });
    }
  }
}
