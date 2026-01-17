/**
 * Webhook Event Handlers
 * Each function handles a specific webhook event type
 */

import {
  WebhookEvent,
  ChatCreatedEvent,
  MessageCreatedEvent,
  ChatNotificationCreatedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  MessageAckUpdatedEvent,
  MessageTicketAttachedEvent,
  ReactionCreatedEvent,
  ReactionUpdatedEvent,
  TicketCreatedEvent,
  TicketUpdatedEvent,
  TicketDeletedEvent,
  MessageFlaggedEvent,
  MessageUnflaggedEvent,
  OrgPhoneUpdatedEvent,
  OrgPhoneConnectedEvent,
  OrgPhoneDisconnectedEvent,
  OrgPhoneQrEvent,
  NoteCreatedEvent,
  ChatCustomPropertiesUpdatedEvent,
} from '../types/webhook';
import { getUserById, createUser, isOneOnOneChat, extractUserIdFromChatId } from '../db/user';
import { periskopeClient } from '../services/periskope';
import { conversationAgent } from '../ai/conversationAgent';

/**
 * Handle chat.created event
 * If chat_id ends in @c.us, it's a 1:1 chat, and we should initialize a profile for the user
 */
export async function handleChatCreated(event: ChatCreatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: chat.created received');
  
  const chatId = event.data?.chat_id || event.data?.chat?.id || (event as any).chat_id || (event as any).chat?.id;
  const chatName = event.data?.chat?.name || event.data?.name || (event as any).chat?.name || 'Unknown';
  
  console.log(`  Chat ID: ${chatId}`);
  console.log(`  Chat Name: ${chatName}`);
  
  // Check if this is a 1:1 chat (ends with @c.us)
  if (chatId && isOneOnOneChat(chatId)) {
    const userId = extractUserIdFromChatId(chatId);
    
    if (userId) {
      console.log(`  Detected 1:1 chat for user ID: ${userId}`);
      
      // Check if user already exists
      const existingUser = await getUserById(userId);
      
      if (!existingUser) {
        // Initialize a profile for the user
        console.log(`  Creating new user profile for user ID: ${userId}`);
        try {
          const newUser = await createUser({
            user_id: userId,
            name: chatName !== 'Unknown' ? chatName : null,
          });
          console.log(`  ✓ User profile created: ${newUser.user_id}`);
        } catch (error) {
          console.error(`  ✗ Error creating user profile:`, error);
          throw error;
        }
      } else {
        console.log(`  User profile already exists for user ID: ${userId}`);
      }
    } else {
      console.log(`  Could not extract user ID from chat_id: ${chatId}`);
    }
  } else {
    console.log(`  Not a 1:1 chat (chat_id: ${chatId}), skipping user initialization`);
  }
}

/**
 * Handle chat.notification.created event
 */
export async function handleChatNotificationCreated(event: ChatNotificationCreatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: chat.notification.created received');
  // TODO: Implement notification handling logic
}

/**
 * Handle message.created event
 * Processes incoming messages and responds using the conversation agent
 */
export async function handleMessageCreated(event: MessageCreatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: message.created received');
  
  // Extract chat_id and message content from the event
  const chatId = event.data?.chat_id || event.data?.message?.chat_id || (event as any).chat_id || (event as any).data?.chat?.id;
  const messageBody = event.data?.message?.body || event.data?.body || (event as any).message?.body || (event as any).body;
  const botPhoneNumber = process.env.PERISKOPE_PHONE_NUMBER;
  
  if (!chatId) {
    console.log('  No chat_id found in event, skipping message processing');
    return;
  }
  
  if (!messageBody) {
    console.log('  No message body found in event, skipping message processing');
    return;
  }
  
  // Skip if message is from the bot itself (avoid infinite loops)
  // Check multiple fields to reliably detect bot messages
  const fromMe = event.data?.from_me;
  const orgPhone = event.data?.org_phone;
  const senderPhone = event.data?.sender_phone;
  const messageFrom = event.data?.message?.from || event.data?.from || (event as any).message?.from || (event as any).from;
  
  // Method 1: Check from_me field (most reliable)
  if (fromMe === true) {
    console.log('  Message is from bot itself (from_me=true), skipping to avoid infinite loop');
    return;
  }
  
  // Method 2: Check if sender_phone matches org_phone (indicates bot sent it)
  if (senderPhone && orgPhone && senderPhone === orgPhone) {
    console.log('  Message sender matches org_phone, skipping to avoid infinite loop');
    return;
  }
  
  // Method 3: Check if sender_phone matches PERISKOPE_PHONE_NUMBER
  if (senderPhone && botPhoneNumber) {
    const normalizedSender = senderPhone.replace('@c.us', '').replace(/[+\s-]/g, '');
    const normalizedBot = botPhoneNumber.replace('@c.us', '').replace(/[+\s-]/g, '');
    if (normalizedSender === normalizedBot) {
      console.log('  Message sender matches PERISKOPE_PHONE_NUMBER, skipping to avoid infinite loop');
      return;
    }
  }
  
  // Method 4: Fallback to original check with messageFrom
  if (messageFrom && botPhoneNumber) {
    const normalizedFrom = messageFrom.replace('@c.us', '').replace(/[+\s-]/g, '');
    const normalizedBot = botPhoneNumber.replace('@c.us', '').replace(/[+\s-]/g, '');
    if (normalizedFrom === normalizedBot) {
      console.log('  Message is from bot itself (fallback check), skipping to avoid infinite loop');
      return;
    }
  }
  
  console.log(`  Chat ID: ${chatId}`);
  console.log(`  Message: ${messageBody}`);
  if (messageFrom) {
    console.log(`  From: ${messageFrom}`);
  }
  
  // Only process 1:1 chats (not group chats)
  if (!isOneOnOneChat(chatId)) {
    console.log('  Not a 1:1 chat, skipping conversation agent processing');
    return;
  }
  
  // Extract user ID from chat_id
  const userId = extractUserIdFromChatId(chatId);
  if (!userId) {
    console.log(`  Could not extract user ID from chat_id: ${chatId}`);
    return;
  }
  
  console.log(`  User ID: ${userId}`);
  
  try {
    // Step 1: Ensure user exists (create if needed)
    let user = await getUserById(userId);
    if (!user) {
      console.log(`  Creating new user profile for user ID: ${userId}`);
      user = await createUser({
        user_id: userId,
      });
      console.log(`  ✓ User profile created: ${user.user_id}`);
    }
    
    // Step 2 & 3: Send message to conversation agent and get response
    console.log('  Sending message to conversation agent...');
    const response = await conversationAgent.sendMessage(userId, messageBody);
    console.log(`  ✓ Received response from conversation agent: ${response}`);
    
    // Step 4: Send response back to user via Periskope
    console.log('  Sending response via Periskope...');
    await periskopeClient.sendMessage(chatId, response);
    console.log(`  ✓ Response sent successfully`);
    
  } catch (error) {
    console.error('  ✗ Error processing message:', error);
    // Don't throw - we want to continue processing other webhooks even if one fails
    // Optionally, you could send an error message to the user here
  }
}

/**
 * Handle message.updated event
 */
export async function handleMessageUpdated(event: MessageUpdatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: message.updated received');
  // TODO: Implement message update handling logic
}

/**
 * Handle message.deleted event
 */
export async function handleMessageDeleted(event: MessageDeletedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: message.deleted received');
  // TODO: Implement message deletion handling logic
}

/**
 * Handle message.ack.updated event
 */
export async function handleMessageAckUpdated(event: MessageAckUpdatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: message.ack.updated received');
  // TODO: Implement acknowledgment update handling logic
}

/**
 * Handle message.ticket.attached event
 */
export async function handleMessageTicketAttached(event: MessageTicketAttachedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: message.ticket.attached received');
  // TODO: Implement ticket attachment handling logic
}

/**
 * Handle reaction.created event
 */
export async function handleReactionCreated(event: ReactionCreatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: reaction.created received');
  // TODO: Implement reaction creation handling logic
}

/**
 * Handle reaction.updated event
 */
export async function handleReactionUpdated(event: ReactionUpdatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: reaction.updated received');
  // TODO: Implement reaction update handling logic
}

/**
 * Handle ticket.created event
 */
export async function handleTicketCreated(event: TicketCreatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: ticket.created received');
  // TODO: Implement ticket creation handling logic
}

/**
 * Handle ticket.updated event
 */
export async function handleTicketUpdated(event: TicketUpdatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: ticket.updated received');
  // TODO: Implement ticket update handling logic
}

/**
 * Handle ticket.deleted event
 */
export async function handleTicketDeleted(event: TicketDeletedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: ticket.deleted received');
  // TODO: Implement ticket deletion handling logic
}

/**
 * Handle message.flagged event
 */
export async function handleMessageFlagged(event: MessageFlaggedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: message.flagged received');
  // TODO: Implement message flagging handling logic
}

/**
 * Handle message.unflagged event
 */
export async function handleMessageUnflagged(event: MessageUnflaggedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: message.unflagged received');
  // TODO: Implement message unflagging handling logic
}

/**
 * Handle org.phone.updated event
 */
export async function handleOrgPhoneUpdated(event: OrgPhoneUpdatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: org.phone.updated received');
  // TODO: Implement org phone update handling logic
}

/**
 * Handle org.phone.connected event
 */
export async function handleOrgPhoneConnected(event: OrgPhoneConnectedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: org.phone.connected received');
  // TODO: Implement org phone connection handling logic
}

/**
 * Handle org.phone.disconnected event
 */
export async function handleOrgPhoneDisconnected(event: OrgPhoneDisconnectedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: org.phone.disconnected received');
  // TODO: Implement org phone disconnection handling logic
}

/**
 * Handle org.phone.qr event
 */
export async function handleOrgPhoneQr(event: OrgPhoneQrEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: org.phone.qr received');
  // TODO: Implement QR code handling logic
}

/**
 * Handle note.created event
 */
export async function handleNoteCreated(event: NoteCreatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: note.created received');
  // TODO: Implement note creation handling logic
}

/**
 * Handle chat.custom_properties.updated event
 */
export async function handleChatCustomPropertiesUpdated(event: ChatCustomPropertiesUpdatedEvent | WebhookEvent): Promise<void> {
  console.log('Event Type: chat.custom_properties.updated received');
  // TODO: Implement custom properties update handling logic
}

/**
 * Event handler mapping
 * Maps event type strings to their corresponding handler functions
 */
export const eventHandlers: Record<string, (event: WebhookEvent) => Promise<void>> = {
  'chat.created': handleChatCreated,
  'chat.notification.created': handleChatNotificationCreated,
  'message.created': handleMessageCreated,
  'message.updated': handleMessageUpdated,
  'message.deleted': handleMessageDeleted,
  'message.ack.updated': handleMessageAckUpdated,
  'message.ticket.attached': handleMessageTicketAttached,
  'reaction.created': handleReactionCreated,
  'reaction.updated': handleReactionUpdated,
  'ticket.created': handleTicketCreated,
  'ticket.updated': handleTicketUpdated,
  'ticket.deleted': handleTicketDeleted,
  'message.flagged': handleMessageFlagged,
  'message.unflagged': handleMessageUnflagged,
  'org.phone.updated': handleOrgPhoneUpdated,
  'org.phone.connected': handleOrgPhoneConnected,
  'org.phone.disconnected': handleOrgPhoneDisconnected,
  'org.phone.qr': handleOrgPhoneQr,
  'note.created': handleNoteCreated,
  'chat.custom_properties.updated': handleChatCustomPropertiesUpdated,
};

/**
 * Route webhook event to appropriate handler
 */
export async function routeWebhookEvent(event: WebhookEvent): Promise<void> {
  const eventType = event.event_type || event.type || event.integration_name || 'unknown';
  
  const handler = eventHandlers[eventType];
  
  if (handler) {
    await handler(event);
  } else {
    console.log(`Event Type: ${eventType} received (no specific handler)`);
  }
}

