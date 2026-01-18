/**
 * Periskope API Client
 * 
 * This is a basic HTTP client for Periskope API.
 * For full SDK functionality, you may want to use an official SDK if available.
 * 
 * API Documentation: https://docs.periskope.app/api-reference/introduction
 */

import dotenv from 'dotenv';

dotenv.config();

const PERISKOPE_API_BASE_URL = 'https://api.periskope.app/v1';

export interface PeriskopeClientConfig {
  apiKey: string;
  phone: string;
}

export class PeriskopeClient {
  private apiKey: string;
  private phone: string;
  private baseUrl: string;

  constructor(config?: PeriskopeClientConfig) {
    this.apiKey = config?.apiKey || process.env.PERISKOPE_API_KEY || '';
    this.phone = config?.phone || process.env.PERISKOPE_PHONE_NUMBER || '';
    this.baseUrl = PERISKOPE_API_BASE_URL;

    if (!this.apiKey) {
      console.warn('Warning: PERISKOPE_API_KEY not set');
    }
    if (!this.phone) {
      console.warn('Warning: PERISKOPE_PHONE_NUMBER not set');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const baseHeaders: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(this.phone ? { 'x-phone': this.phone } : {}),
    };
    const optionsHeadersObj = options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : (options.headers as Record<string, string> || {});
    const headers: Record<string, string> = { ...baseHeaders, ...optionsHeadersObj };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Periskope API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Periskope API request failed:', error);
      throw error;
    }
  }

  /**
   * Send a message
   * POST /messages/send
   */
  async sendMessage(chatId: string, message: string): Promise<any> {
    return this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        chat_id: chatId,
        message: message,
      }),
    });
  }

  /**
   * Get chat by ID
   * GET /chats/{id}
   */
  async getChatById(chatId: string): Promise<any> {
    return this.request(`/chats/${chatId}`);
  }

  /**
   * Get contact by ID
   * GET /contacts/{id}
   */
  async getContactById(contactId: string): Promise<any> {
    return this.request(`/contacts/${contactId}`);
  }

  /**
   * Get messages in a chat
   * GET /chats/{chat_id}/messages
   * @param chatId - The chat ID (e.g., '919537851844@c.us')
   * @param offset - Pagination offset (default: 0)
   * @param limit - Maximum number of messages to return (default: 2000)
   */
  async getMessagesInChat(chatId: string, offset: number = 0, limit: number = 2000): Promise<any> {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });
    return this.request(`/chats/${chatId}/messages?${params.toString()}`);
  }

  /**
   * List all webhooks
   * GET /webhooks
   */
  async listWebhooks(): Promise<any> {
    return this.request('/webhooks');
  }

  /**
   * Get webhook by ID
   * GET /webhooks/{id}
   */
  async getWebhookById(id: string): Promise<any> {
    return this.request(`/webhooks/${id}`);
  }

  /**
   * Create a new webhook
   * POST /webhooks
   * @param url - Webhook URL (must be publicly accessible)
   * @param events - Array of event types to subscribe to
   * @param integrationName - Integration name for the webhook
   * @param signingKey - Optional signing key for webhook verification
   * @param enabled - Whether the webhook is enabled (default: true)
   */
  async createWebhook(
    url: string,
    events: string[],
    integrationName: string,
    signingKey?: string,
    enabled: boolean = true
  ): Promise<any> {
    const body: any = {
      hookUrl: url,
      integrationName,
      events,
      enabled,
    };

    if (signingKey) {
      body.signing_key = signingKey;
    }

    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Update a webhook
   * PATCH /webhooks/{id}
   * @param id - Webhook ID
   * @param updates - Webhook update fields
   */
  async updateWebhook(
    id: string,
    updates: {
      url?: string;
      events?: string[];
      enabled?: boolean;
      signing_key?: string;
    }
  ): Promise<any> {
    return this.request(`/webhooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a webhook
   * DELETE /webhooks/{id}
   */
  async deleteWebhook(id: string): Promise<void> {
    await this.request(`/webhooks/${id}`, {
      method: 'DELETE',
    });
  }
}

// Export a singleton instance
export const periskopeClient = new PeriskopeClient();

