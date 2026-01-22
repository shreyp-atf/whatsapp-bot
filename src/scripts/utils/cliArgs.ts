/**
 * CLI Argument Parser Utility
 * 
 * Provides robust argument parsing using yargs for all scripts.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export type Provider = 'xai' | 'openai';

export interface BaseScriptConfig {
  provider: Provider;
  enableLogging?: boolean;
}

export interface EventExtractionConfig extends BaseScriptConfig {
  url: string;
}

export interface VenueAgentConfig extends BaseScriptConfig {
  venueName: string;
}

export interface SeedVenuesConfig extends BaseScriptConfig {
  // No additional args needed, reads from file
}

/**
 * Parse arguments for event extraction script
 */
export function parseEventExtractionArgs(): EventExtractionConfig {
  const argv = yargs(hideBin(process.argv))
    .option('use-xai', {
      type: 'boolean',
      default: false,
      description: 'Use xAI instead of OpenAI (default)'
    })
    .option('logging', {
      type: 'boolean',
      default: false,
      alias: 'l',
      description: 'Enable detailed logging'
    })
    .option('url', {
      type: 'string',
      description: 'URL to process'
    })
    .command('$0 <url>', 'Process event URL', (yargs) => {
      return yargs.positional('url', {
        type: 'string',
        demandOption: true,
        description: 'URL to process'
      });
    })
    .parseSync();
  
  // Fix: yargs positional arguments can be in argv._ array or as named property depending on command structure
  const url = (argv.url || argv._[0]) as string;
  
  if (!url) {
    throw new Error('URL is required. Usage: ts-node src/scripts/runEventExtraction.ts <url> [--use-xai] [--logging]');
  }
  
  return {
    provider: argv['use-xai'] ? 'xai' : 'openai',
    enableLogging: argv.logging,
    url: url
  };
}

/**
 * Parse arguments for venue agent script
 */
export function parseVenueAgentArgs(): VenueAgentConfig {
  const argv = yargs(hideBin(process.argv))
    .option('use-xai', {
      type: 'boolean',
      default: false,
      description: 'Use xAI instead of OpenAI (default)'
    })
    .option('logging', {
      type: 'boolean',
      default: false,
      alias: 'l',
      description: 'Enable detailed logging'
    })
    .option('venueName', {
      type: 'string',
      description: 'Venue name to process'
    })
    .command('$0 <venueName>', 'Process venue', (yargs) => {
      return yargs.positional('venueName', {
        type: 'string',
        demandOption: true,
        description: 'Venue name to process'
      });
    })
    .parseSync();
  
  // Fix: yargs positional arguments can be in argv._ array or as named property depending on command structure
  const venueName = (argv.venueName || argv._[0]) as string;
  
  if (!venueName) {
    throw new Error('Venue name is required. Usage: ts-node src/scripts/runVenueAgent.ts <venueName> [--use-xai] [--logging]');
  }
  
  return {
    provider: argv['use-xai'] ? 'xai' : 'openai',
    enableLogging: argv.logging,
    venueName: venueName
  };
}

/**
 * Parse arguments for seed venues script
 */
export function parseSeedVenuesArgs(): SeedVenuesConfig {
  const argv = yargs(hideBin(process.argv))
    .option('use-xai', {
      type: 'boolean',
      default: false,
      description: 'Use xAI instead of OpenAI (default)'
    })
    .option('logging', {
      type: 'boolean',
      default: false,
      alias: 'l',
      description: 'Enable detailed logging'
    })
    .parseSync();
  
  return {
    provider: argv['use-xai'] ? 'xai' : 'openai',
    enableLogging: argv.logging
  };
}

/**
 * Parse base arguments (provider and logging) for any script
 */
export function parseBaseArgs(): BaseScriptConfig {
  const argv = yargs(hideBin(process.argv))
    .option('use-xai', {
      type: 'boolean',
      default: false,
      description: 'Use xAI instead of OpenAI (default)'
    })
    .option('logging', {
      type: 'boolean',
      default: false,
      alias: 'l',
      description: 'Enable detailed logging'
    })
    .parseSync();
  
  return {
    provider: argv['use-xai'] ? 'xai' : 'openai',
    enableLogging: argv.logging
  };
}
