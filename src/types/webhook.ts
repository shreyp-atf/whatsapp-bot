/**
 * TypeScript types for Periskope webhook events
 */

export interface WebhookEvent {
  event_type?: string;
  type?: string;
  integration_name?: string;
  data?: any;
  timestamp?: string;
  [key: string]: any;
}

export interface ChatCreatedEvent extends WebhookEvent {
  event_type: 'chat.created';
  data: {
    chat_id: string;
    chat?: {
      id: string;
      name?: string;
      type?: string;
    };
    contact_id?: string;
    [key: string]: any;
  };
}

export interface MessageCreatedEvent extends WebhookEvent {
  event_type: 'message.created';
  data: {
    message_id?: string;
    chat_id?: string;
    message?: {
      id?: string;
      body?: string;
      from?: string;
      to?: string;
    };
    [key: string]: any;
  };
}

export interface ChatNotificationCreatedEvent extends WebhookEvent {
  event_type: 'chat.notification.created';
  data?: any;
}

export interface MessageUpdatedEvent extends WebhookEvent {
  event_type: 'message.updated';
  data?: any;
}

export interface MessageDeletedEvent extends WebhookEvent {
  event_type: 'message.deleted';
  data?: any;
}

export interface MessageAckUpdatedEvent extends WebhookEvent {
  event_type: 'message.ack.updated';
  data?: any;
}

export interface MessageTicketAttachedEvent extends WebhookEvent {
  event_type: 'message.ticket.attached';
  data?: any;
}

export interface ReactionCreatedEvent extends WebhookEvent {
  event_type: 'reaction.created';
  data?: any;
}

export interface ReactionUpdatedEvent extends WebhookEvent {
  event_type: 'reaction.updated';
  data?: any;
}

export interface TicketCreatedEvent extends WebhookEvent {
  event_type: 'ticket.created';
  data?: any;
}

export interface TicketUpdatedEvent extends WebhookEvent {
  event_type: 'ticket.updated';
  data?: any;
}

export interface TicketDeletedEvent extends WebhookEvent {
  event_type: 'ticket.deleted';
  data?: any;
}

export interface MessageFlaggedEvent extends WebhookEvent {
  event_type: 'message.flagged';
  data?: any;
}

export interface MessageUnflaggedEvent extends WebhookEvent {
  event_type: 'message.unflagged';
  data?: any;
}

export interface OrgPhoneUpdatedEvent extends WebhookEvent {
  event_type: 'org.phone.updated';
  data?: any;
}

export interface OrgPhoneConnectedEvent extends WebhookEvent {
  event_type: 'org.phone.connected';
  data?: any;
}

export interface OrgPhoneDisconnectedEvent extends WebhookEvent {
  event_type: 'org.phone.disconnected';
  data?: any;
}

export interface OrgPhoneQrEvent extends WebhookEvent {
  event_type: 'org.phone.qr';
  data?: any;
}

export interface NoteCreatedEvent extends WebhookEvent {
  event_type: 'note.created';
  data?: any;
}

export interface ChatCustomPropertiesUpdatedEvent extends WebhookEvent {
  event_type: 'chat.custom_properties.updated';
  data?: any;
}

