import dotenv from 'dotenv';
import express from 'express';
import { createHmac } from 'crypto';
import { handleMention, isMentionEvent } from './src/handlers/mentionHandler.js';
import { routeWebhookEvent } from './src/handlers/webhookEventHandlers.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to capture raw body for signature verification on webhook endpoint
app.use('/webhook', express.raw({ type: 'application/json' }));

// Middleware to parse JSON bodies for other routes
app.use(express.json());

/**
 * Verify webhook signature using HMAC SHA-256
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - Signature from x-periskope-signature header
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(rawBody, signature) {
  const signingKey = process.env.PERISKOPE_SIGNING_KEY;
  
  if (!signingKey) {
    console.error('Error: PERISKOPE_SIGNING_KEY not set in environment variables');
    return false;
  }

  if (!signature) {
    console.error('Error: x-periskope-signature header is missing');
    return false;
  }

  const hmac = createHmac('sha256', signingKey);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  
  return digest === signature;
}

// Webhook endpoint to receive all Periskope events
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-periskope-signature'];
  
  // Verify signature
  const isValid = verifySignature(req.body, signature);
  
  if (!isValid) {
    console.error('✗ Invalid webhook signature - rejecting request');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse the body as JSON after verification
  const event = JSON.parse(req.body.toString());
  
  // Print the entire event to console
  console.log('\n=== Webhook Event Received ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Event Type:', event.event_type || event.type || event.integration_name || 'unknown');
  console.log('Full Event Data:');
  console.log(JSON.stringify(event, null, 2));
  console.log('================================\n');
  
  // Route webhook event to appropriate handler
  await routeWebhookEvent(event);
  
  // Handle mention events (keep existing mention handling logic)
  if (isMentionEvent(event)) {
    await handleMention(event);
  }
  
  // Always return 200 to acknowledge receipt
  res.status(200).json({ status: 'received' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Group message participants endpoint
app.post('/group/message_participants/', async (req, res) => {
  try {
    // Validate group_id is provided
    const { group_id } = req.body;
    
    if (!group_id) {
      return res.status(400).json({ 
        error: 'group_id is required',
        status: 'error'
      });
    }

    // Initialize PeriskopeSDK client
    const client = new PeriskopeSDK({
      apiKey: process.env.PERISKOPE_API_KEY,
      phone: process.env.PERISKOPE_PHONE_NUMBER,
    });

    // Retrieve group information using /chats/{id} endpoint
    // Base URL now includes /v1 prefix to match API requirements
    let groupData;
    try {
      groupData = await client.chats.getById(group_id);
    } catch (error) {
      if (error.statusCode === 404 || error.message?.includes('not found') || error.message?.includes('Invalid route')) {
        return res.status(404).json({
          error: 'Group not found',
          status: 'error',
          error_message: error.message,
          group_id
        });
      }
      throw error;
    }

    // Extract participants from group data
    // The API returns 'members' object, not 'participants'
    let participants = [];
    
    // Check for 'members' object (Periskope API format)
    if (groupData.members && typeof groupData.members === 'object') {
      // Members is an object with contact_id as keys
      participants = Object.values(groupData.members);
    } else if (groupData.participants) {
      // Fallback to participants if it exists
      if (Array.isArray(groupData.participants)) {
        participants = groupData.participants;
      } else if (typeof groupData.participants === 'object') {
        participants = groupData.participants.list || 
                      groupData.participants.data || 
                      Object.values(groupData.participants).filter(Array.isArray)[0] || 
                      Object.values(groupData.participants) || 
                      [];
      }
    }

    // If no participants found in expected format, check for alternative structures
    if (participants.length === 0) {
      if (groupData.data?.participants) {
        participants = Array.isArray(groupData.data.participants) 
          ? groupData.data.participants 
          : [];
      } else if (groupData.data?.members) {
        participants = typeof groupData.data.members === 'object' 
          ? Object.values(groupData.data.members)
          : [];
      }
    }

    const totalParticipants = participants.length;

    if (totalParticipants === 0) {
      return res.status(200).json({
        status: 'success',
        group_id,
        total_participants: 0,
        messages_sent: 0,
        messages_failed: 0,
        failures: [],
        message: 'No participants found in group'
      });
    }

    // Send messages to each participant
    const results = {
      sent: 0,
      failed: 0,
      failures: []
    };

    const messageText = 'Hello from the group!';

    // Process participants sequentially to avoid rate limiting issues
    for (const participant of participants) {
      try {
        // Extract participant ID - handle different formats
        let participantId;
        if (typeof participant === 'string') {
          participantId = participant;
        } else if (participant.id) {
          participantId = participant.id;
        } else if (participant.participant_id) {
          participantId = participant.participant_id;
        } else if (participant.contact_id) {
          participantId = participant.contact_id;
        } else if (participant.phone) {
          participantId = participant.phone;
        } else {
          // Skip if we can't identify the participant
          results.failed++;
          results.failures.push({
            participant: participant,
            error: 'Could not extract participant ID'
          });
          continue;
        }

        // Send message to participant using /message/send endpoint
        await client.messages.send({
          chat_id: participantId,
          message: messageText
        });

        results.sent++;
      } catch (error) {
        results.failed++;
        results.failures.push({
          participant: participant,
          error: error.message || 'Failed to send message'
        });
        // Continue with next participant even if one fails
      }
    }

    // Return response
    return res.status(200).json({
      status: 'success',
      group_id,
      total_participants: totalParticipants,
      messages_sent: results.sent,
      messages_failed: results.failed,
      failures: results.failures
    });

  } catch (error) {
    console.error('Error in /group/message_participants/:', error);
    return res.status(500).json({
      error: 'Internal server error',
      status: 'error',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Webhook server is running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  if (process.env.PERISKOPE_SIGNING_KEY) {
    console.log('✓ Webhook signature verification enabled');
  } else {
    console.error('✗ Error: PERISKOPE_SIGNING_KEY not set - webhook requests will be rejected');
  }
  
  console.log('\nWaiting for webhook events...\n');
});

