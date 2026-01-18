/**
 * Webhook Registration Module
 * Registers the server to all Periskope webhook events
 */

import dotenv from 'dotenv';
import { periskopeClient } from './periskope';
import { eventHandlers } from '../handlers/webhookEventHandlers';

dotenv.config();

export interface RegistrationResult {
  success: boolean;
  webhookId?: string;
  error?: string;
  message?: string;
}

/**
 * Get all webhook event types from event handlers
 */
function getAllWebhookEventTypes(): string[] {
  return Object.keys(eventHandlers);
}

/**
 * Validate webhook URL
 */
function validateWebhookUrl(url: string): { valid: boolean; warning?: string } {
  if (!url) {
    return { valid: false };
  }

  try {
    const urlObj = new URL(url);
    
    // Accept both http and https
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return {
        valid: false,
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Register webhooks for all event types
 * @param webhookUrl - Optional webhook URL (defaults to WEBHOOK_URL env var)
 * @param signingKey - Optional signing key (defaults to PERISKOPE_SIGNING_KEY env var)
 * @returns Registration result
 */
export async function registerWebhooks(
  webhookUrl?: string,
  signingKey?: string
): Promise<RegistrationResult> {
  const url = webhookUrl || process.env.WEBHOOK_URL;
  const key = signingKey || process.env.PERISKOPE_SIGNING_KEY;

  // Validate webhook URL
  if (!url) {
    return {
      success: false,
      error: 'WEBHOOK_URL environment variable is not set',
      message: 'Please set WEBHOOK_URL in your .env file with your publicly accessible webhook URL',
    };
  }

  const urlValidation = validateWebhookUrl(url);
  if (!urlValidation.valid) {
    return {
      success: false,
      error: 'Invalid webhook URL format',
      message: `WEBHOOK_URL must be a valid HTTP or HTTPS URL. Current value: ${url}`,
    };
  }

  // Get all event types
  const eventTypes = getAllWebhookEventTypes();
  
  if (eventTypes.length === 0) {
    return {
      success: false,
      error: 'No webhook event types found',
      message: 'No event handlers are registered. Cannot create webhook subscription.',
    };
  }

  console.log(`📋 Registering webhook for ${eventTypes.length} event types:`);
  eventTypes.forEach((eventType) => {
    console.log(`   - ${eventType}`);
  });
  console.log(`🔗 Webhook URL: ${url}`);

  try {
    // Attempt to create webhook
    const integrationName = process.env.WEBHOOK_INTEGRATION_NAME || 'whatsapp-bot';
    const webhook = await periskopeClient.createWebhook(
      url,
      eventTypes,
      integrationName,
      key,
      true // enabled
    );

    console.log(`✅ Webhook registered successfully!`);
    console.log(`   Webhook ID: ${webhook.id || 'N/A'}`);
    console.log(`   URL: ${webhook.url || url}`);
    console.log(`   Events: ${webhook.events?.length || eventTypes.length} event types`);
    console.log(`   Enabled: ${webhook.enabled !== false ? 'Yes' : 'No'}`);

    return {
      success: true,
      webhookId: webhook.id,
      message: 'Webhook registered successfully',
    };
  } catch (error: any) {
    // Handle specific error cases
    if (error.message?.includes('404') || error.message?.includes('405')) {
      return {
        success: false,
        error: 'Webhook creation endpoint not found',
        message:
          'The Periskope API endpoint for creating webhooks may not be available. ' +
          'You may need to register webhooks manually through the Periskope dashboard. ' +
          `Error: ${error.message}`,
      };
    }

    if (error.message?.includes('401') || error.message?.includes('403')) {
      return {
        success: false,
        error: 'Authentication failed',
        message:
          'Invalid API key or insufficient permissions. ' +
          'Please check your PERISKOPE_API_KEY environment variable. ' +
          `Error: ${error.message}`,
      };
    }

    // Generic error
    return {
      success: false,
      error: 'Failed to register webhook',
      message: error.message || 'Unknown error occurred while registering webhook',
    };
  }
}

registerWebhooks(process.env.WEBHOOK_URL, process.env.PERISKOPE_SIGNING_KEY);