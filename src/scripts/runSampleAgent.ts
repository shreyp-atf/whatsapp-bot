/**
 * Script to run the sample agent with web search
 *
 * This script uses OpenAI's Agents framework with web search tools.
 * The agent performs web research and extracts information in JSON format.
 */

import { runWorkflow } from '../ai/sample_agent_with_web_search';

async function main() {
  try {
    // Get input text from command line arguments
    const inputText = process.argv.slice(2).join(' ');

    if (!inputText) {
      console.error('✗ Error: Input text is required as command line argument');
      console.log('Usage: ts-node src/scripts/runSampleAgent.ts "<your input text here>"');
      console.log('Example: ts-node src/scripts/runSampleAgent.ts "Find upcoming music concerts and festivals in New York City"');
      process.exit(1);
    }

    console.log('Starting sample agent with web search...\n');
    console.log(`Input: ${inputText}\n`);

    const result = await runWorkflow({ input_as_text: inputText });

    console.log('Agent Results:');
    console.log('==============');
    console.log('Output Text:', result.output_text);
    console.log('\nParsed Output:');
    console.log(JSON.stringify(result.output_parsed, null, 2));

    console.log('\n✓ Sample agent execution completed successfully');
  } catch (error) {
    console.error('✗ Error running sample agent:', error);
    process.exit(1);
  }
}

// Run the script
main();