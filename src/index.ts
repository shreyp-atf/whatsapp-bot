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
import { logger } from './utils/logging';

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
 * Webhook endpoint to receive all Periskope events
 */
app.post('/webhook', async (req: Request, res: Response) => {
  logger.info('Route: POST /webhook - Entry', {
    route: '/webhook',
    method: 'POST',
    hasSignature: !!req.headers['x-periskope-signature'],
    bodyLength: req.body?.length || 0,
  });
  
  try {
    const signature = req.headers['x-periskope-signature'] as string | undefined;
    const rawBody = req.body as Buffer;
    
    logger.info('Route: POST /webhook - Verifying signature', {
      route: '/webhook',
      hasSignature: !!signature,
      bodyLength: rawBody?.length || 0,
    });
    
    // Verify signature
    const isValid = verifySignature(
      rawBody,
      signature,
      process.env.PERISKOPE_SIGNING_KEY
    );
    
    logger.info('Route: POST /webhook - Signature verification result', {
      route: '/webhook',
      isValid,
    });
    
    if (!isValid) {
      logger.error('Route: POST /webhook - Invalid signature', new Error('Invalid webhook signature'), {
        route: '/webhook',
        hasSignature: !!signature,
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the body as JSON after verification
    const event: WebhookEvent = JSON.parse(rawBody.toString());
    
    logger.info('Route: POST /webhook - Event parsed, routing', {
      route: '/webhook',
      eventType: event.type || 'unknown',
      hasData: !!event.data,
    });
    
    // Route webhook event to appropriate handler
    await routeWebhookEvent(event);
    
    logger.info('Route: POST /webhook - Event routed successfully', {
      route: '/webhook',
      eventType: event.type || 'unknown',
    });
    
    // Always return 200 to acknowledge receipt
    res.status(200).json({ status: 'received' });
  } catch (error) {
    logger.error('Route: POST /webhook - Error processing webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/webhook',
    });
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
  logger.info('Route: GET /health - Entry', {
    route: '/health',
    method: 'GET',
  });
  
  const response = { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    services: {
      webhook: 'active',
      api: 'active'
    }
  };
  
  logger.info('Route: GET /health - Exit', {
    route: '/health',
    response,
  });
  
  res.status(200).json(response);
});

/**
 * API Routes
 */

/**
 * Create a new user
 * POST /api/users
 * Body: { mobileNumber: number, persona: object }
 */
app.post('/api/users', (req: Request, res: Response) => {
  logger.info('Route: POST /api/users - Entry', {
    route: '/api/users',
    method: 'POST',
    body: JSON.stringify(req.body).substring(0, 500),
  });
  handleCreateUser(req, res);
});

/**
 * Get user by mobile number
 * POST /api/users/get
 * Body: { mobile_number: string }
 */
app.post('/api/users/get', (req: Request, res: Response) => {
  logger.info('Route: POST /api/users/get - Entry', {
    route: '/api/users/get',
    method: 'POST',
    body: JSON.stringify(req.body).substring(0, 500),
  });
  handleGetUser(req, res);
});

/**
 * Get user persona by user ID
 * GET /api/users/:userId/persona
 */
app.get('/api/users/:userId/persona', (req: Request, res: Response) => {
  logger.info('Route: GET /api/users/:userId/persona - Entry', {
    route: '/api/users/:userId/persona',
    method: 'GET',
    userId: req.params.userId,
  });
  handleGetUserPersona(req, res);
});

/**
 * Get chat history by chat ID
 * GET /api/chats/:chatId/messages
 * Query params: offset (optional, default: 0), limit (optional, default: 2000)
 */
app.get('/api/chats/:chatId/messages', (req: Request, res: Response) => {
  logger.info('Route: GET /api/chats/:chatId/messages - Entry', {
    route: '/api/chats/:chatId/messages',
    method: 'GET',
    chatId: req.params.chatId,
    query: req.query,
  });
  handleGetChatMessages(req, res);
});

/**
 * Get activity venue map by ID
 * GET /api/activity-venue-maps/:id
 */
app.get('/api/activity-venue-maps/:id', (req: Request, res: Response) => {
  logger.info('Route: GET /api/activity-venue-maps/:id - Entry', {
    route: '/api/activity-venue-maps/:id',
    method: 'GET',
    id: req.params.id,
  });
  handleGetActivityVenueMap(req, res);
});

/**
 * Send event details as WhatsApp message to user
 * POST /api/send-event-details
 * Body: { activityVenueMapId: number, userId: number }
 */
app.post('/api/send-event-details', (req: Request, res: Response) => {
  logger.info('Route: POST /api/send-event-details - Entry', {
    route: '/api/send-event-details',
    method: 'POST',
    body: JSON.stringify(req.body).substring(0, 500),
  });
  handleSendEventDetails(req, res);
});

/**
 * Fetch activity venue maps by city and datetime
 * POST /api/activity-venue-maps
 * Body: { userId: number, datetime: string (ISO 8601) }
 */
app.post('/api/activity-venue-maps', (req: Request, res: Response) => {
  logger.info('Route: POST /api/activity-venue-maps - Entry', {
    route: '/api/activity-venue-maps',
    method: 'POST',
    body: JSON.stringify(req.body).substring(0, 500),
  });
  handleGetActivityVenueMaps(req, res);
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

  const host = process.env.HOST || 'localhost';
  const portSuffix = PORT === 80 ? '' : `:${PORT}`;
  const baseUrl = `http://${host}${portSuffix}`;

  const startCallback = () => {
    console.log(`\n🚀 Webhook Server`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`\n📡 Webhook Endpoints:`);
    console.log(`  POST ${baseUrl}/webhook - Periskope webhook events`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`  GET  ${baseUrl}/health - Health check`);
    console.log(`  POST ${baseUrl}/api/users`);
    console.log(`  POST ${baseUrl}/api/users/get`);
    console.log(`  GET  ${baseUrl}/api/users/:userId/persona`);
    console.log(`  GET  ${baseUrl}/api/chats/:chatId/messages?offset=0&limit=2000`);
    console.log(`  GET  ${baseUrl}/api/activity-venue-maps/:id`);
    console.log(`  POST ${baseUrl}/api/activity-venue-maps`);
    console.log(`  POST ${baseUrl}/api/send-event-details`);
    
    if (process.env.PERISKOPE_SIGNING_KEY) {
      console.log('\n✓ Webhook signature verification enabled');
    } else {
      console.error('\n✗ Warning: PERISKOPE_SIGNING_KEY not set - webhook requests will be rejected');
    }

    console.log(`\n✓ Webhook server ready and waiting for events...\n`);
  };

  app.listen(PORT, startCallback);
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
