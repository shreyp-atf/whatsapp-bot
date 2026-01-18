#!/usr/bin/env node
/**
 * Webhook Registration Script
 * 
 * Registers the server to all Periskope webhook events.
 * 
 * Usage:
 *   npm run register-webhooks
 *   or
 *   ts-node src/scripts/registerWebhooks.ts
 */

import { registerWebhooks } from '../services/webhookRegistration';

async function main() {
  console.log('🚀 Starting webhook registration...\n');

  const result = await registerWebhooks();

  console.log('\n' + '='.repeat(60));

  if (result.success) {
    console.log('✅ Webhook registration completed successfully!');
    if (result.webhookId) {
      console.log(`   Webhook ID: ${result.webhookId}`);
    }
    process.exit(0);
  } else {
    console.error('❌ Webhook registration failed!');
    console.error(`   Error: ${result.error}`);
    if (result.message) {
      console.error(`   Details: ${result.message}`);
    }
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Unexpected error during webhook registration:');
  console.error(error);
  process.exit(1);
});
