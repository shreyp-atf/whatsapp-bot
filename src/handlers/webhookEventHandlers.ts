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
import { processMessage } from '../ai/openai/conversation';
import { logger } from '../utils/logging';

/**
 * Handle chat.created event
 * If chat_id ends in @c.us, it's a 1:1 chat, and we should initialize a profile for the user
 * This is the SINGLE SOURCE OF TRUTH for user creation - users are created here when chats are created
 */
export async function handleChatCreated(event: ChatCreatedEvent | WebhookEvent): Promise<void> {
  logger.info('Webhook Handler: handleChatCreated - Entry', {
    handler: 'handleChatCreated',
    eventType: 'chat.created',
  });
  
  const chatId = event.data?.chat_id || event.data?.chat?.id || (event as any).chat_id || (event as any).chat?.id;
  const chatName = event.data?.chat?.name || event.data?.name || (event as any).chat?.name || 'Unknown';
  
  logger.info('Webhook Handler: handleChatCreated - Extracted Data', {
    handler: 'handleChatCreated',
    chatId,
    chatName,
  });
  
  // Check if this is a 1:1 chat (ends with @c.us)
  if (chatId && isOneOnOneChat(chatId)) {
    const userId = extractUserIdFromChatId(chatId);
    
    if (userId) {
      logger.info('Webhook Handler: handleChatCreated - Detected 1:1 chat', {
        handler: 'handleChatCreated',
        userId,
        chatId,
      });
      
      // Check if user already exists
      const existingUser = await getUserById(userId);
      
      if (!existingUser) {
        // Initialize a profile for the user with minimal data (just user_id)
        logger.info('Webhook Handler: handleChatCreated - Creating new user', {
          handler: 'handleChatCreated',
          userId,
        });
        
        try {
          const newUser = await createUser({
            user_id: userId,
          });
          
          logger.info('Webhook Handler: handleChatCreated - User created successfully', {
            handler: 'handleChatCreated',
            userId: newUser.user_id,
            createdAt: newUser.created_at,
          });
        } catch (error) {
          logger.error('Webhook Handler: handleChatCreated - Error creating user', error instanceof Error ? error : new Error(String(error)), {
            handler: 'handleChatCreated',
            userId,
            chatId,
          });
          throw error;
        }
      } else {
        logger.info('Webhook Handler: handleChatCreated - User already exists', {
          handler: 'handleChatCreated',
          userId,
        });
      }
    } else {
      logger.warn('Webhook Handler: handleChatCreated - Could not extract user ID', {
        handler: 'handleChatCreated',
        chatId,
      });
    }
  } else {
    logger.info('Webhook Handler: handleChatCreated - Not a 1:1 chat, skipping', {
      handler: 'handleChatCreated',
      chatId,
      isOneOnOne: false,
    });
  }
  
  logger.info('Webhook Handler: handleChatCreated - Exit', {
    handler: 'handleChatCreated',
  });
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
 * Processes incoming messages and responds using the master agent (which routes to appropriate agents)
 */
export async function handleMessageCreated(event: MessageCreatedEvent | WebhookEvent): Promise<void> {
  logger.info('Webhook Handler: handleMessageCreated - Entry', {
    handler: 'handleMessageCreated',
    eventType: 'message.created',
    eventData: {
      hasData: !!event.data,
      chatId: event.data?.chat_id || event.data?.message?.chat_id || (event as any).chat_id || null,
      messageBody: event.data?.message?.body || event.data?.body || (event as any).message?.body || null,
    },
  });
  
  // Extract chat_id and message content from the event
  const chatId = event.data?.chat_id || event.data?.message?.chat_id || (event as any).chat_id || (event as any).data?.chat?.id;
  const messageBody = event.data?.message?.body || event.data?.body || (event as any).message?.body || (event as any).body;
  const botPhoneNumber = process.env.PERISKOPE_PHONE_NUMBER;
  
  logger.info('Webhook Handler: handleMessageCreated - Extracted Data', {
    handler: 'handleMessageCreated',
    chatId,
    messageBody: messageBody?.substring(0, 200) + (messageBody && messageBody.length > 200 ? '...' : ''),
    messageBodyLength: messageBody?.length || 0,
    hasBotPhoneNumber: !!botPhoneNumber,
  });
  
  if (!chatId) {
    logger.warn('Webhook Handler: handleMessageCreated - No chat_id found', {
      handler: 'handleMessageCreated',
      eventData: Object.keys(event),
    });
    return;
  }
  
  if (!messageBody) {
    logger.warn('Webhook Handler: handleMessageCreated - No message body found', {
      handler: 'handleMessageCreated',
      chatId,
    });
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
    logger.info('Webhook Handler: handleMessageCreated - Bot message detected (from_me)', {
      handler: 'handleMessageCreated',
      chatId,
      reason: 'from_me=true',
    });
    return;
  }
  
  // Method 2: Check if sender_phone matches org_phone (indicates bot sent it)
  if (senderPhone && orgPhone && senderPhone === orgPhone) {
    logger.info('Webhook Handler: handleMessageCreated - Bot message detected (sender matches org)', {
      handler: 'handleMessageCreated',
      chatId,
      reason: 'sender_phone matches org_phone',
      senderPhone,
      orgPhone,
    });
    return;
  }
  
  // Method 3: Check if sender_phone matches PERISKOPE_PHONE_NUMBER
  if (senderPhone && botPhoneNumber) {
    const normalizedSender = senderPhone.replace('@c.us', '').replace(/[+\s-]/g, '');
    const normalizedBot = botPhoneNumber.replace('@c.us', '').replace(/[+\s-]/g, '');
    if (normalizedSender === normalizedBot) {
      logger.info('Webhook Handler: handleMessageCreated - Bot message detected (sender matches bot number)', {
        handler: 'handleMessageCreated',
        chatId,
        reason: 'sender_phone matches PERISKOPE_PHONE_NUMBER',
        senderPhone,
        botPhoneNumber,
      });
      return;
    }
  }
  
  // Method 4: Fallback to original check with messageFrom
  if (messageFrom && botPhoneNumber) {
    const normalizedFrom = messageFrom.replace('@c.us', '').replace(/[+\s-]/g, '');
    const normalizedBot = botPhoneNumber.replace('@c.us', '').replace(/[+\s-]/g, '');
    if (normalizedFrom === normalizedBot) {
      logger.info('Webhook Handler: handleMessageCreated - Bot message detected (fallback check)', {
        handler: 'handleMessageCreated',
        chatId,
        reason: 'messageFrom matches bot number',
        messageFrom,
        botPhoneNumber,
      });
      return;
    }
  }
  
  logger.info('Webhook Handler: handleMessageCreated - Processing user message', {
    handler: 'handleMessageCreated',
    chatId,
    messageBody: messageBody.substring(0, 200) + (messageBody.length > 200 ? '...' : ''),
    messageBodyLength: messageBody.length,
    messageFrom: messageFrom || null,
  });
  
  // Only process 1:1 chats (not group chats)
  if (!isOneOnOneChat(chatId)) {
    logger.info('Webhook Handler: handleMessageCreated - Not a 1:1 chat, skipping', {
      handler: 'handleMessageCreated',
      chatId,
      isOneOnOne: false,
    });
    return;
  }
  
  // Extract user ID from chat_id
  const userId = extractUserIdFromChatId(chatId);
  if (!userId) {
    logger.warn('Webhook Handler: handleMessageCreated - Could not extract user ID', {
      handler: 'handleMessageCreated',
      chatId,
    });
    return;
  }
  
  logger.info('Webhook Handler: handleMessageCreated - Extracted User ID', {
    handler: 'handleMessageCreated',
    chatId,
    userId,
  });
  
  try {
    // Users should already exist from chat.created event
    // If user doesn't exist, this indicates a race condition (message.created arrived before chat.created)
    // In this case, create the user as a fallback to handle the race condition gracefully
    let user = await getUserById(userId);
    
    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'webhookEventHandlers.ts:268',message:'User lookup result',data:{userId,userExists:!!user,chatId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!user) {
      logger.warn('Webhook Handler: handleMessageCreated - User does not exist (race condition detected)', {
        handler: 'handleMessageCreated',
        userId,
        chatId,
        message: 'message.created arrived before chat.created. Creating user as fallback.',
      });
      
      // #region agent log
      fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'webhookEventHandlers.ts:277',message:'Race condition detected, creating user',data:{userId,chatId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Create user as fallback to handle race condition
      try {
        user = await createUser({
          user_id: userId,
        });
        
        // #region agent log
        fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'webhookEventHandlers.ts:285',message:'User created successfully as fallback',data:{userId,userCreated:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        logger.info('Webhook Handler: handleMessageCreated - User created as fallback', {
          handler: 'handleMessageCreated',
          userId: user.user_id,
          chatId,
        });
      } catch (createError) {
        logger.error('Webhook Handler: handleMessageCreated - Error creating user fallback', createError instanceof Error ? createError : new Error(String(createError)), {
          handler: 'handleMessageCreated',
          userId,
          chatId,
        });
        // If creation fails (e.g., duplicate key), try fetching again
        user = await getUserById(userId);
        if (!user) {
          // Still no user, can't proceed
          return;
        }
      }
    }
    
    logger.info('Webhook Handler: handleMessageCreated - User exists', {
      handler: 'handleMessageCreated',
      userId,
      hasConversationId: !!user.conversation_id,
    });
    
    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'webhookEventHandlers.ts:295',message:'About to call processMessage',data:{userId,hasUser:!!user,messageLength:messageBody.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Send message to master agent (which routes to appropriate agents) and get response
    logger.info('Webhook Handler: handleMessageCreated - Calling processMessage', {
      handler: 'handleMessageCreated',
      userId,
      messageBody: messageBody.substring(0, 200) + (messageBody.length > 200 ? '...' : ''),
      messageBodyLength: messageBody.length,
    });
    
    const response = await processMessage(user, messageBody);
    
    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'webhookEventHandlers.ts:302',message:'processMessage returned successfully',data:{userId,responseLength:response.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    logger.info('Webhook Handler: handleMessageCreated - Received response from processMessage', {
      handler: 'handleMessageCreated',
      userId,
      responseLength: response.length,
      response: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
    });
    
    // Step 4: Send response back to user via Periskope
    logger.info('Webhook Handler: handleMessageCreated - Sending response via Periskope', {
      handler: 'handleMessageCreated',
      userId,
      chatId,
      responseLength: response.length,
    });
    
    await periskopeClient.sendMessage(chatId, response);
    
    logger.info('Webhook Handler: handleMessageCreated - Response sent successfully', {
      handler: 'handleMessageCreated',
      userId,
      chatId,
      responseLength: response.length,
    });
    
  } catch (error) {
    // #region agent log
    fetch('http://localhost:7245/ingest/75957693-e320-4792-b4f1-71ee9934f46b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'webhookEventHandlers.ts:321',message:'Error in handleMessageCreated',data:{userId,chatId,errorMessage:error instanceof Error ? error.message : String(error),errorStack:error instanceof Error ? error.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    logger.error('Webhook Handler: handleMessageCreated - Error processing message', error instanceof Error ? error : new Error(String(error)), {
      handler: 'handleMessageCreated',
      userId,
      chatId,
      messageBody: messageBody?.substring(0, 200),
    });
    // Don't throw - we want to continue processing other webhooks even if one fails
    // Optionally, you could send an error message to the user here
  }
  
  logger.info('Webhook Handler: handleMessageCreated - Exit', {
    handler: 'handleMessageCreated',
    userId,
  });
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

