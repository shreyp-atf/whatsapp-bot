/**
 * OpenAI API Client
 * 
 * This module provides a basic interface to interact with OpenAI's ChatGPT API.
 * It handles prompt processing and LLM responses.
 * 
 * API Documentation: https://platform.openai.com/docs/quickstart
 */

import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

export interface AIClientConfig {
  apiKey?: string;
  model?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  messages?: ChatMessage[];
}

export class AIClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config?: AIClientConfig) {
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required. Please set it in your .env file or pass it as a config parameter.');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });

    this.defaultModel = config?.model || 'gpt-3.5-turbo';
  }

  /**
   * Get a response from the LLM given a prompt
   * @param prompt - The user's prompt/question
   * @param options - Optional configuration for the chat completion
   * @returns The assistant's response text
   */
  async getResponse(prompt: string, options?: ChatCompletionOptions): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: options?.messages || [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        throw new Error('No response received from OpenAI API');
      }

      return response;
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      throw error;
    }
  }

  /**
   * Get a response using a custom message history
   * Useful for maintaining conversation context
   * @param messages - Array of chat messages with roles
   * @param options - Optional configuration for the chat completion
   * @returns The assistant's response text
   */
  async getChatResponse(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        throw new Error('No response received from OpenAI API');
      }

      return response;
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      throw error;
    }
  }

  /**
   * Get the raw completion object from OpenAI
   * Useful when you need access to additional metadata (tokens used, finish reason, etc.)
   * @param prompt - The user's prompt/question
   * @param options - Optional configuration for the chat completion
   * @returns The full completion object from OpenAI
   */
  async getCompletion(prompt: string, options?: ChatCompletionOptions): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      const completion = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: options?.messages || [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      });

      return completion;
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      throw error;
    }
  }

  /**
   * Check the status of the OpenAI connection by sending a simple "Knock Knock" prompt
   * @returns true if the connection is successful, false otherwise
   */
  async checkStatus(): Promise<boolean> {
    try {
      const response = await this.getResponse('Knock Knock', {
        temperature: 0.3,
        maxTokens: 50,
      });
      
      // If we get a response, the connection is working
      return response !== null && response.length > 0;
    } catch (error) {
      console.error('OpenAI status check failed:', error);
      return false;
    }
  }
}

/**
 * Check OpenAI connection status on server initialization
 * This function handles errors gracefully and can be called even if API key is not set
 * @returns true if OpenAI is configured and connection is successful, false otherwise
 */
export async function checkOpenAIStatus(): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return false;
  }

  try {
    const client = new AIClient();
    const isConnected = await client.checkStatus();
    return isConnected;
  } catch (error) {
    return false;
  }
}

// Export a singleton instance (lazy initialization)
// Will throw if OPENAI_API_KEY is not set when first accessed
// Use checkOpenAIStatus() for graceful status checking during initialization
let _aiClientInstance: AIClient | null = null;

function createAIClient(): AIClient {
  if (!_aiClientInstance) {
    _aiClientInstance = new AIClient();
  }
  return _aiClientInstance;
}

// Export singleton getter - initializes on first access
// This allows the module to be imported even if API key is not set
export const aiClient = new Proxy({} as AIClient, {
  get(_target, prop) {
    const client = createAIClient();
    const value = client[prop as keyof AIClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Export optimizer
export { optimizePlansForUser } from './optimizer';

// Export conversation agent
export { ConversationAgent, conversationAgent } from './conversationAgent';
export type { ConversationAgentConfig, ConversationMessage } from './conversationAgent';

// Export extraction agent
export { ExtractionAgent, extractionAgent } from './extractionAgent';
export type { ExtractionAgentConfig } from './extractionAgent';
