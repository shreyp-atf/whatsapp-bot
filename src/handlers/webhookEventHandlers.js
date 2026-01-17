/**
 * Webhook Event Handlers
 * Each function handles a specific webhook event type
 */

/**
 * Handle chat.created event
 * @param {object} event - Webhook event object
 */
export async function handleChatCreated(event) {
  console.log('Event Type : chat.created received');
  
  // Additional processing for chat.created event
  // TODO: Add your custom processing logic here
  const chatId = event.data?.chat_id || event.data?.chat?.id || event.chat_id || event.chat?.id;
  const chatName = event.data?.chat?.name || event.data?.name || event.chat?.name || 'Unknown';
  
  console.log(`  Chat ID: ${chatId}`);
  console.log(`  Chat Name: ${chatName}`);
  
  // Add your additional processing here
}

/**
 * Handle chat.notification.created event
 * @param {object} event - Webhook event object
 */
export async function handleChatNotificationCreated(event) {
  console.log('Event Type : chat.notification.created received');
}

/**
 * Handle message.created event
 * @param {object} event - Webhook event object
 */
export async function handleMessageCreated(event) {
  console.log('Event Type : message.created received');
}

/**
 * Handle message.updated event
 * @param {object} event - Webhook event object
 */
export async function handleMessageUpdated(event) {
  console.log('Event Type : message.updated received');
}

/**
 * Handle message.deleted event
 * @param {object} event - Webhook event object
 */
export async function handleMessageDeleted(event) {
  console.log('Event Type : message.deleted received');
}

/**
 * Handle message.ack.updated event
 * @param {object} event - Webhook event object
 */
export async function handleMessageAckUpdated(event) {
  console.log('Event Type : message.ack.updated received');
}

/**
 * Handle message.ticket.attached event
 * @param {object} event - Webhook event object
 */
export async function handleMessageTicketAttached(event) {
  console.log('Event Type : message.ticket.attached received');
}

/**
 * Handle reaction.created event
 * @param {object} event - Webhook event object
 */
export async function handleReactionCreated(event) {
  console.log('Event Type : reaction.created received');
}

/**
 * Handle reaction.updated event
 * @param {object} event - Webhook event object
 */
export async function handleReactionUpdated(event) {
  console.log('Event Type : reaction.updated received');
}

/**
 * Handle ticket.created event
 * @param {object} event - Webhook event object
 */
export async function handleTicketCreated(event) {
  console.log('Event Type : ticket.created received');
}

/**
 * Handle ticket.updated event
 * @param {object} event - Webhook event object
 */
export async function handleTicketUpdated(event) {
  console.log('Event Type : ticket.updated received');
}

/**
 * Handle ticket.deleted event
 * @param {object} event - Webhook event object
 */
export async function handleTicketDeleted(event) {
  console.log('Event Type : ticket.deleted received');
}

/**
 * Handle message.flagged event
 * @param {object} event - Webhook event object
 */
export async function handleMessageFlagged(event) {
  console.log('Event Type : message.flagged received');
}

/**
 * Handle message.unflagged event
 * @param {object} event - Webhook event object
 */
export async function handleMessageUnflagged(event) {
  console.log('Event Type : message.unflagged received');
}

/**
 * Handle org.phone.updated event
 * @param {object} event - Webhook event object
 */
export async function handleOrgPhoneUpdated(event) {
  console.log('Event Type : org.phone.updated received');
}

/**
 * Handle org.phone.connected event
 * @param {object} event - Webhook event object
 */
export async function handleOrgPhoneConnected(event) {
  console.log('Event Type : org.phone.connected received');
}

/**
 * Handle org.phone.disconnected event
 * @param {object} event - Webhook event object
 */
export async function handleOrgPhoneDisconnected(event) {
  console.log('Event Type : org.phone.disconnected received');
}

/**
 * Handle org.phone.qr event
 * @param {object} event - Webhook event object
 */
export async function handleOrgPhoneQr(event) {
  console.log('Event Type : org.phone.qr received');
}

/**
 * Handle note.created event
 * @param {object} event - Webhook event object
 */
export async function handleNoteCreated(event) {
  console.log('Event Type : note.created received');
}

/**
 * Handle chat.custom_properties.updated event
 * @param {object} event - Webhook event object
 */
export async function handleChatCustomPropertiesUpdated(event) {
  console.log('Event Type : chat.custom_properties.updated received');
}

/**
 * Event handler mapping
 * Maps event type strings to their corresponding handler functions
 */
export const eventHandlers = {
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
 * @param {object} event - Webhook event object
 */
export async function routeWebhookEvent(event) {
  const eventType = event.event_type || event.type || event.integration_name || 'unknown';
  
  const handler = eventHandlers[eventType];
  
  if (handler) {
    await handler(event);
  } else {
    console.log(`Event Type : ${eventType} received (no specific handler)`);
  }
}







