/**
 * Extraction Agent
 * 
 * This module provides an OpenAI agent that reads extraction prompts
 * and uses the Responses API (v1/responses) to generate responses.
 */

import { webSearchTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { z } from "zod";
import dotenv from 'dotenv';
import { readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

// Web search tool configuration
const webSearchPreview = webSearchTool({
  searchContextSize: "medium",
  userLocation: {
    city: "Gurugram",
    country: "IN",
    region: "Haryana",
    type: "approximate"
  }
});

// Schema for extraction agent output
// #region agent log
try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:schema',message:'Creating schema',data:{schemaType:'ExtractionAgentSchema'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
// #endregion
const ExtractionAgentSchema = z.object({
  extracted_data: z.array(z.object({})), // Array of objects - z.object({}) converts to {"type": "object"} which satisfies OpenAI's requirements
  url: z.string(),
  timestamp: z.string(),
  model: z.string()
});
// #region agent log
try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:schema',message:'Schema created',data:{hasExtractedData:true,extractedDataType:'z.array(z.object({}))'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
// #endregion

// Create the extraction agent with web search capabilities
const createWebExtractionAgent = (extractionPrompt: string, extractionRole: string, model: string = 'gpt-5-nano') => {
  return new Agent({
    name: "Web Extraction Agent",
    instructions: `${extractionRole}\n\nYou have access to web search capabilities. Use the websearchpreview tool to:\n- Access and analyze web pages\n- Search for information on the internet\n- Gather data from websites\n- Extract content from URLs\n\nDo NOT attempt to access web content directly. Always use the websearchpreview tool for all web-related tasks.\n\n${extractionPrompt}\n\nIMPORTANT: Your response must include:\n- extracted_data: The extracted information\n- url: The URL that was processed\n- timestamp: Current timestamp in ISO format\n- model: The model used for extraction`,
    model: model,
    tools: [
      webSearchPreview
    ],
    outputType: ExtractionAgentSchema,
    modelSettings: {
      reasoning: {
        effort: "high"
      },
      store: true
    }
  });
};

export interface ExtractionAgentConfig {
  apiKey?: string;
  model?: string;
  extractionPromptPath?: string;
  extractionRolePath?: string;
}

export class ExtractionAgent {
  private agent: any;
  private defaultModel: string;
  private extractionPrompt: string;
  private extractionRole: string;

  constructor(config?: ExtractionAgentConfig) {
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required. Please set it in your .env file or pass it as a config parameter.');
    }

    // Set the API key for the agents framework
    process.env.OPENAI_API_KEY = apiKey;

    this.defaultModel = config?.model || 'gpt-5-nano';

    // Load extraction prompt
    const promptPath = config?.extractionPromptPath || join(process.cwd(), 'ai', 'extraction_prompt.txt');
    try {
      this.extractionPrompt = readFileSync(promptPath, 'utf-8');
      console.log(`✓ Loaded extraction prompt from ${promptPath}`);
    } catch (error) {
      throw new Error(`Failed to load extraction prompt from ${promptPath}: ${error}`);
    }

    // Load extraction role (if exists)
    const rolePath = config?.extractionRolePath || join(process.cwd(), 'src', 'ai', 'extraction_role.txt');
    try {
      this.extractionRole = readFileSync(rolePath, 'utf-8');
      console.log(`✓ Loaded extraction role from ${rolePath}`);
    } catch (error) {
      console.warn(`Failed to load extraction role from ${rolePath}, using default`);
      this.extractionRole = 'You are a helpful assistant that extracts structured information.';
    }

    // Create the agent with loaded prompt and role
    // #region agent log
    try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:constructor',message:'Creating agent instance',data:{model:this.defaultModel,hasPrompt:!!this.extractionPrompt,hasRole:!!this.extractionRole},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){}
    // #endregion
    this.agent = createWebExtractionAgent(this.extractionPrompt, this.extractionRole, this.defaultModel);
    // #region agent log
    try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:constructor',message:'Agent created',data:{agentCreated:!!this.agent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n');}catch(e){}
    // #endregion
    console.log(`✓ Created extraction agent with model: ${this.defaultModel}`);
  }


  /**
   * Execute the extraction using the OpenAI Agents framework with web search
   * @param url - The URL to extract information from
   * @param options - Optional configuration
   * @returns The extraction result with structured data
   */
  async execute(url: string, options?: {
    model?: string;
    temperature?: number;
  }): Promise<{ extracted_data: any[]; url: string; timestamp: string; model: string }> {
    try {
      // Create a prompt that instructs the agent to use web search to access the URL
      const fullPrompt = `${this.extractionPrompt}\n\nPlease extract information from this URL: ${url}\n\nUse the websearchpreview tool to access and analyze the web page content.\n\nURL: ${url}\nTimestamp: ${new Date().toISOString()}\nModel: ${options?.model || this.defaultModel}`;

      const conversationHistory: AgentInputItem[] = [
        { role: "user", content: [{ type: "input_text", text: fullPrompt }] }
      ];

      const runner = new Runner({
        traceMetadata: {
          __trace_source__: "extraction-agent",
          url: url,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`✓ Running extraction agent for URL: ${url}`);
      // #region agent log
      try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:execute',message:'About to run agent',data:{url:url,hasAgent:!!this.agent,conversationHistoryLength:conversationHistory.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){}
      // #endregion

      let result;
      try {
        // #region agent log
        try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:execute',message:'Calling runner.run',data:{agentName:this.agent?.name,hasTools:!!this.agent?.tools,outputType:!!this.agent?.outputType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n');}catch(e){}
        // #endregion
        result = await runner.run(
          this.agent,
          conversationHistory
        );
        // #region agent log
        try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:execute',message:'Agent run completed',data:{hasResult:!!result,hasFinalOutput:!!result?.finalOutput},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){}
        // #endregion
      } catch (runError: any) {
        // #region agent log
        try{require('fs').appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:execute',message:'Runner.run error caught',data:{errorMessage:runError?.message,errorCode:runError?.code,errorType:runError?.type,errorParam:runError?.param,status:runError?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})+'\n');}catch(e){}
        // #endregion
        throw runError;
      }

      if (!result.finalOutput) {
        throw new Error("Agent result is undefined");
      }

      // The agent now returns structured data that includes metadata
      return result.finalOutput;
    } catch (error) {
      console.error('Agent execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute extraction and print the response to console
   * @param url - The URL to fetch HTML content from
   */
  async executeAndPrint(url: string, options?: {
    model?: string;
    temperature?: number;
  }): Promise<void> {
    try {
      const result = await this.execute(url);

      // #region agent log
      try{appendFileSync('/home/ubuntu/whatsapp-bot/.cursor/debug.log',JSON.stringify({location:'extractionAgent.ts:executeAndPrint',message:'Agent result received',data:{hasExtractedData:!!result.extracted_data,hasUrl:!!result.url,hasTimestamp:!!result.timestamp,hasModel:!!result.model},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
      // #endregion

      // Print the response output
      console.log('\n=== Extraction Result ===');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n=== End of Result ===\n');
    } catch (error) {
      console.error('Failed to execute extraction:', error);
      throw error;
    }
  }
}

// Export a singleton instance (lazy initialization)
let _extractionAgentInstance: ExtractionAgent | null = null;

function createExtractionAgent(): ExtractionAgent {
  if (!_extractionAgentInstance) {
    _extractionAgentInstance = new ExtractionAgent();
  }
  return _extractionAgentInstance;
}

// Export singleton getter - initializes on first access
export const extractionAgent = new Proxy({} as ExtractionAgent, {
  get(_target, prop) {
    const agent = createExtractionAgent();
    const value = agent[prop as keyof ExtractionAgent];
    if (typeof value === 'function') {
      return value.bind(agent);
    }
    return value;
  }
});
