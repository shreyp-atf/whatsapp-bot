import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { routeWebhookEvent } from './handlers/webhookEventHandlers';
import { verifySignature } from './utils/webhook';
import { WebhookEvent } from './types/webhook';
import { pingDatabase } from './db/connection';
import { checkOpenAIStatus } from './ai';
import { handleCreateUser, handleGetUser, handleGetUserPersona } from './handlers/userHandlers';
import { handleGetChatMessages } from './handlers/chatHandlers';
import { handleGetActivityVenueMap, handleSendEventDetails, handleGetActivityVenueMaps } from './handlers/activityVenueMapHandlers';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware to capture raw body for signature verification on webhook endpoint
app.use('/webhook', express.raw({ type: 'application/json' }));

// Middleware to parse JSON bodies for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Request logging middleware - logs all incoming queries
 */
app.use((req: Request, res: Response, next: express.NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const query = Object.keys(req.query).length > 0 ? req.query : undefined;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Mask sensitive headers
  const headers = { ...req.headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-periskope-signature', 'x-api-key'];
  sensitiveHeaders.forEach(header => {
    if (headers[header]) {
      headers[header] = '[REDACTED]';
    }
  });
  
  // Handle body - could be Buffer (for webhook) or object (for other routes)
  let body = req.body;
  if (body instanceof Buffer) {
    // For webhook routes with raw body, try to parse and log
    try {
      const parsed = JSON.parse(body.toString());
      body = parsed;
      // Mask sensitive fields
      if (typeof body === 'object' && body !== null) {
        body = { ...body };
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'signingKey'];
        sensitiveFields.forEach(field => {
          if (body[field]) {
            body[field] = '[REDACTED]';
          }
        });
      }
    } catch {
      // If parsing fails, just log as raw buffer info
      body = `[Buffer: ${body.length} bytes]`;
    }
  } else if (body && typeof body === 'object') {
    // For parsed JSON bodies, mask sensitive fields
    body = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'signingKey'];
    sensitiveFields.forEach(field => {
      if (body[field]) {
        body[field] = '[REDACTED]';
      }
    });
  }
  
  // Log the request
  console.log('\n=== Incoming Query ===');
  console.log('Timestamp:', timestamp);
  console.log('Method:', method);
  console.log('Path:', path);
  if (query) {
    console.log('Query Parameters:', JSON.stringify(query, null, 2));
  }
  if (body && Object.keys(body).length > 0) {
    console.log('Request Body:', JSON.stringify(body, null, 2));
  }
  console.log('Headers:', JSON.stringify(headers, null, 2));
  console.log('IP Address:', ip);
  console.log('User-Agent:', req.headers['user-agent'] || 'unknown');
  console.log('========================\n');
  
  next();
});

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
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    services: {
      webhook: 'active',
      api: 'active'
    }
  });
});

/**
 * API Routes
 */

/**
 * Create a new user
 * POST /api/users
 * Body: { mobileNumber: number, persona: object }
 */
app.post('/api/users', handleCreateUser);

/**
 * Get user by mobile number
 * POST /api/users/get
 * Body: { mobile_number: string }
 */
app.post('/api/users/get', handleGetUser);

/**
 * Get user persona by user ID
 * GET /api/users/:userId/persona
 */
app.get('/api/users/:userId/persona', handleGetUserPersona);

/**
 * Get chat history by chat ID
 * GET /api/chats/:chatId/messages
 * Query params: offset (optional, default: 0), limit (optional, default: 2000)
 */
app.get('/api/chats/:chatId/messages', handleGetChatMessages);

/**
 * Get activity venue map by ID
 * GET /api/activity-venue-maps/:id
 */
app.get('/api/activity-venue-maps/:id', handleGetActivityVenueMap);

/**
 * Send event details as WhatsApp message to user
 * POST /api/send-event-details
 * Body: { activityVenueMapId: number, userId: number }
 */
app.post('/api/send-event-details', handleSendEventDetails);

/**
 * Fetch activity venue maps by city and datetime
 * POST /api/activity-venue-maps
 * Body: { userId: number, datetime: string (ISO 8601) }
 */
app.post('/api/activity-venue-maps', handleGetActivityVenueMaps);


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


  const host = process.env.HOST || 'localhost';
  const portSuffix = PORT === 80 ? '' : `:${PORT}`;
  const baseUrl = `http://${host}${portSuffix}`;

  const startCallback = () => {
    console.log(`\n🚀 WhatsApp Bot Server (HTTP)`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: ${baseUrl}/health`);
    console.log(`Webhook endpoint: ${baseUrl}/webhook`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`  POST ${baseUrl}/api/users`);
    console.log(`  GET  ${baseUrl}/api/users/:userId`);
    console.log(`  GET  ${baseUrl}/api/users/:userId/persona`);
    console.log(`  GET  ${baseUrl}/api/chats/:chatId/messages?offset=0&limit=2000`);
    console.log(`  GET  ${baseUrl}/api/activity-venue-maps/:id`);
    console.log(`  POST ${baseUrl}/api/activity-venue-maps`);
    console.log(`  POST ${baseUrl}/api/send-event-details`);
    
    if (process.env.PERISKOPE_SIGNING_KEY) {
      console.log('✓ Webhook signature verification enabled');
    } else {
      console.error('✗ Warning: PERISKOPE_SIGNING_KEY not set - webhook requests will be rejected');
    }

    console.log(`\n✓ Server running in HTTP mode`);
    console.log(`  Webhook URL for Periskope: ${baseUrl}/webhook`);
    
    console.log('\nWaiting for webhook events...\n');
  };

  app.listen(PORT, startCallback);
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
