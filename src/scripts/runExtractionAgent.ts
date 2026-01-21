/**
 * Script to run the extraction agent
 *
 * This script reads the extraction prompt and uses OpenAI's Agents framework
 * with web search tools to access web content and extract information.
 * The agent relies entirely on websearchpreview tool for all web-related tasks.
 */

import { ExtractionAgent } from '../ai/extractionAgent';

async function main() {
  try {
    // Get URL from command line arguments
    const url = process.argv[2];

    if (!url) {
      console.error('✗ Error: URL is required as command line argument');
      console.log('Usage: npm run extract <url>');
      process.exit(1);
    }

    console.log('Starting extraction agent...\n');
    console.log(`Target URL: ${url}\n`);

    const agent = new ExtractionAgent();

    console.log('Executing extraction using websearchpreview tool...\n');
    await agent.executeAndPrint(url);

    console.log('✓ Extraction completed successfully');
  } catch (error) {
    console.error('✗ Error running extraction agent:', error);
    process.exit(1);
  }
}

// Run the script
main();
