/**
 * Script to run event extraction pipeline
 *
 * This script takes a URL and runs it through the URL processing pipeline
 * to extract and create database entities: city, city_region, locality, venue,
 * activity, and activity_venue_map entries.
 * 
 * Usage: ts-node src/scripts/runEventExtraction.ts <url> [--use-xai] [--logging]
 * Example: ts-node src/scripts/runEventExtraction.ts "https://example.com/events"
 * Example: ts-node src/scripts/runEventExtraction.ts "https://example.com/events" --use-xai --logging
 */

import { runUrlProcessingPipeline } from '../ai/workflows';
import { executeWithProviderFallback } from '../ai/utils/providerSelection';
import { parseEventExtractionArgs } from './utils/cliArgs';

async function main() {
  try {
    const config = parseEventExtractionArgs();
    const { url, provider, enableLogging } = config;

    console.log(`Starting event extraction pipeline (provider: ${provider})...\n`);
    console.log(`URL: ${url}\n`);

    // Run the URL processing pipeline with fallback
    const { result, provider: actualProvider } = await executeWithProviderFallback(
      async (p) => runUrlProcessingPipeline(url, p, {
        enableLogging: enableLogging || false,
        enableTracing: true,
        maxRetries: 2
      }),
      provider,
      { enableLogging: enableLogging || false }
    );

    if (actualProvider !== provider && enableLogging) {
      console.log(`Note: Fell back to ${actualProvider} provider\n`);
    }

    if (result.success) {
      console.log(`✓ Event extraction completed successfully!\n`);
      console.log('Results:');
      console.log(`  - Provider: ${actualProvider}`);
      console.log(`  - Execution time: ${result.executionTime}ms`);
      
      if (result.city_id) {
        console.log(`  - City ID: ${result.city_id}${result.created_new_city ? ' (new)' : ''}`);
      }
      if (result.city_region_id) {
        console.log(`  - City Region ID: ${result.city_region_id}${result.created_new_city_region ? ' (new)' : ''}`);
      }
      if (result.locality_id) {
        console.log(`  - Locality ID: ${result.locality_id}${result.created_new_locality ? ' (new)' : ''}`);
      }
      if (result.venue_id) {
        console.log(`  - Venue ID: ${result.venue_id}${result.created_new_venue ? ' (new)' : ''}`);
      }
      if (result.activity_id) {
        console.log(`  - Activity ID: ${result.activity_id}${result.created_new_activity ? ' (new)' : ''}`);
      }
      if (result.activity_venue_map_id) {
        console.log(`  - Activity Venue Map ID: ${result.activity_venue_map_id}`);
      }
    } else {
      console.error('✗ Event extraction failed');
      if (result.error) {
        console.error(`Error: ${result.error.message}`);
        if (result.error.stack) {
          console.error(result.error.stack);
        }
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error running event extraction:', error);
    process.exit(1);
  }
}

// Run the script
main();
