import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { routeWebhookEvent } from './handlers/webhookEventHandlers';
import { verifySignature } from './utils/webhook';
import { WebhookEvent } from './types/webhook';
import { pingDatabase } from './db/connection';
import { checkOpenAIStatus } from './ai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to capture raw body for signature verification on webhook endpoint
app.use('/webhook', express.raw({ type: 'application/json' }));

// Middleware to parse JSON bodies for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Webhook endpoint to receive all Periskope events
 */
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-periskope-signature'] as string | undefined;
    const rawBody = req.body as Buffer;
    
    // Verify signature
    const isValid = verifySignature(
      rawBody,
      signature,
      process.env.PERISKOPE_SIGNING_KEY
    );
    
    if (!isValid) {
      console.error('✗ Invalid webhook signature - rejecting request');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the body as JSON after verification
    const event: WebhookEvent = JSON.parse(rawBody.toString());
    
    // Print the entire event to console
    console.log('\n=== Webhook Event Received ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Event Type:', event.event_type || event.type || event.integration_name || 'unknown');
    console.log('Full Event Data:');
    console.log(JSON.stringify(event, null, 2));
    console.log('================================\n');
    
    // Route webhook event to appropriate handler
    await routeWebhookEvent(event);
    
    // Always return 200 to acknowledge receipt
    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured'
  });
});

/**
 * Initialize database connection and start server
 */
async function startServer() {
  // Verify database connection before starting server
  if (process.env.DATABASE_URL) {
    console.log('Verifying database connection...');
    const isConnected = await pingDatabase();
    if (isConnected) {
      console.log('✓ Database connection verified');
    } else {
      console.error('✗ Failed to verify database connection - server will start but database operations may fail');
    }
  } else {
    console.error('✗ Warning: DATABASE_URL not set - database operations will fail');
  }

  // Verify OpenAI connection before starting server
  console.log('Verifying OpenAI connection...');
  const isOpenAIConnected = await checkOpenAIStatus();
  if (isOpenAIConnected) {
    console.log('✓ OpenAI connection verified');
  } else {
    if (process.env.OPENAI_API_KEY) {
      console.error('✗ Failed to verify OpenAI connection - server will start but AI operations may fail');
    } else {
      console.error('✗ Warning: OPENAI_API_KEY not set - AI operations will fail');
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Bot Server`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
    
    if (process.env.PERISKOPE_SIGNING_KEY) {
      console.log('✓ Webhook signature verification enabled');
    } else {
      console.error('✗ Warning: PERISKOPE_SIGNING_KEY not set - webhook requests will be rejected');
    }
    
    console.log('\nWaiting for webhook events...\n');
  });
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
