/**
 * Script to run xAI event extraction pipeline
 *
 * This script takes a URL and runs it through the xAI URL processing pipeline
 * to extract and create database entities: city, city_region, locality, venue,
 * activity, and activity_venue_map entries.
 */

import { runUrlProcessingPipeline } from '../ai/xai';

async function main() {
  try {
    // Get URL from command line arguments
    const args = process.argv.slice(2);

    if (args.length < 1) {
      console.error('✗ Error: URL is required as command line argument');
      console.log('Usage: ts-node src/scripts/runXaiEventExtraction.ts "<url>"');
      console.log('Example: ts-node src/scripts/runXaiEventExtraction.ts "https://example.com/events"');
      process.exit(1);
    }

    const url = args[0];

    console.log('Starting xAI event extraction pipeline...\n');
    console.log(`URL: ${url}\n`);

    // Run the xAI URL processing pipeline
    const result = await runUrlProcessingPipeline(url, {
      enableLogging: true,
      enableTracing: true,
      maxRetries: 2
    });

    if (result.success) {
      console.log('✓ xAI event extraction completed successfully!\n');
      console.log('Results:');
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
      console.error('✗ xAI event extraction failed');
      if (result.error) {
        console.error(`Error: ${result.error.message}`);
        if (result.error.stack) {
          console.error(result.error.stack);
        }
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error running xAI event extraction:', error);
    process.exit(1);
  }
}

// Run the script
main();
