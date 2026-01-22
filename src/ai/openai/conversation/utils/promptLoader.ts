/**
 * Prompt Loader
 * 
 * Utility for loading prompts from files with caching
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const promptCache: Map<string, string> = new Map();

/**
 * Get the base path for prompts directory
 */
function getPromptsPath(): string {
  // Try multiple paths to handle both dev and production
  const possiblePaths = [
    join(process.cwd(), 'src', 'ai', 'openai', 'conversation', 'prompts'),
    join(__dirname, '..', 'prompts'),
    join(__dirname, 'prompts'),
  ];

  for (const path of possiblePaths) {
    try {
      // Try to read a file to verify the path exists
      readFileSync(join(path, 'systemMessage.md'), 'utf-8');
      return path;
    } catch (error) {
      continue;
    }
  }

  // Fallback to first path
  return possiblePaths[0];
}

/**
 * Load a prompt file with caching
 */
export function loadPrompt(filename: string): string {
  const cacheKey = filename;
  
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  try {
    const promptsPath = getPromptsPath();
    const filePath = join(promptsPath, filename);
    const content = readFileSync(filePath, 'utf-8');
    promptCache.set(cacheKey, content);
    return content;
  } catch (error) {
    console.error(`Failed to load prompt file: ${filename}`, error);
    throw new Error(`Failed to load prompt file: ${filename}`);
  }
}

/**
 * Clear the prompt cache (useful for testing or hot-reloading)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Load system message
 */
export function loadSystemMessage(): string {
  return loadPrompt('systemMessage.md');
}

/**
 * Load error fallback message
 */
export function loadErrorFallback(): string {
  return loadPrompt('errorFallback.md');
}

/**
 * Load agent prompt
 */
export function loadAgentPrompt(agentName: string): string {
  return loadPrompt(`${agentName}.prompt.md`);
}

/**
 * Load onboarding questions
 */
export function loadOnboardingQuestions(): any[] {
  try {
    const promptsPath = getPromptsPath();
    const filePath = join(promptsPath, 'onboardingQuestions.json');
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load onboarding questions', error);
    return [];
  }
}
