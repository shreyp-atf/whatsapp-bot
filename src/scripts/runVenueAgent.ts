/**
 * Script to run the venue agent
 *
 * This script uses the venue agent to generate venue and locality database rows
 * based on venue name and location input.
 */

import { runVenueLocalityWorkflow, performVenueDatabaseOperations } from '../ai/venueAgent';
import { withTransaction } from '../db/connection';
import { parseVenueAgentArgs } from './utils/cliArgs';

async function main() {
  try {
    const config = parseVenueAgentArgs();
    const { venueName, enableLogging } = config;

    // Note: Venue agent currently only supports OpenAI
    // Provider selection is parsed but not yet implemented for venue workflow
    console.log(`Note: Venue agent currently uses OpenAI (provider selection coming soon)\n`);

    if (enableLogging) {
      console.log('📊 LLM query timing enabled\n');
    }

    console.log('Starting venue agent...\n');
    console.log(`Venue Name: ${venueName}`);

    // Step 1: Run LLM agent to get venue data
    const venueAgentStart = enableLogging ? Date.now() : 0;
    const agentResult = await runVenueLocalityWorkflow({
      venue_name: venueName,
    }, enableLogging);
    const venueAgentTime = enableLogging ? Date.now() - venueAgentStart : 0;

    if (enableLogging) {
      console.log(`\n[LLM Timing] Venue Agent: ${venueAgentTime}ms`);
      console.log(`[LLM Response] Venue Agent:`);
      console.log(JSON.stringify(agentResult.output_parsed, null, 2));
    }

    console.log('Agent Results:');
    console.log('==============');
    console.log('Output Text:', agentResult.output_text);
    console.log('\nParsed Output:');
    console.log(JSON.stringify(agentResult.output_parsed, null, 2));

    // Step 2: Perform database operations in a transaction
    console.log('\nPerforming database operations in transaction...');
    const dbOpsStart = enableLogging ? Date.now() : 0;
    const databaseResult = await withTransaction(async (client) => {
      return await performVenueDatabaseOperations(agentResult.output_parsed, client, enableLogging);
    });
    const dbOpsTime = enableLogging ? Date.now() - dbOpsStart : 0;

    if (enableLogging) {
      console.log(`\n[LLM Timing] Database Operations (similarity matching): ${dbOpsTime}ms`);
      console.log(`[LLM Timing] Total: ${venueAgentTime + dbOpsTime}ms`);
    }

    console.log('\nDatabase Operations:');
    console.log('===================');
    console.log(`City ID: ${databaseResult.city_id} ${databaseResult.created_new_city ? '(NEW)' : '(EXISTING)'}`);
    console.log(`City Region ID: ${databaseResult.city_region_id} ${databaseResult.created_new_city_region ? '(NEW)' : '(EXISTING)'}`);
    console.log(`Locality ID: ${databaseResult.locality_id} ${databaseResult.created_new_locality ? '(NEW)' : '(EXISTING)'}`);
    console.log(`Venue ID: ${databaseResult.venue_id} ${databaseResult.created_new_venue ? '(NEW)' : '(EXISTING)'}`);

    console.log('\n✓ Venue agent execution completed successfully');
  } catch (error) {
    console.error('✗ Error running venue agent:', error);
    process.exit(1);
  }
}

// Run the script
main();