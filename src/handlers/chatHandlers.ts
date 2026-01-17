/**
 * Chat API Handlers
 * Handlers for chat-related endpoints
 */

import { Request, Response } from 'express';
import { periskopeClient } from '../services/periskope';

/**
 * Get chat history by chat ID
 * GET /api/chats/:chatId/messages
 * Query params: offset (optional, default: 0), limit (optional, default: 2000)
 */
export async function handleGetChatMessages(req: Request, res: Response): Promise<void> {
  try {
    const chatId = req.params.chatId;
    
    if (!chatId || typeof chatId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'chatId is required and must be a string'
      });
      return;
    }

    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 2000;

    if (isNaN(offset) || offset < 0) {
      res.status(400).json({
        success: false,
        error: 'offset must be a non-negative number'
      });
      return;
    }

    if (isNaN(limit) || limit < 1) {
      res.status(400).json({
        success: false,
        error: 'limit must be a positive number'
      });
      return;
    }

    const chatHistory = await periskopeClient.getMessagesInChat(chatId, offset, limit);

    res.status(200).json({
      success: true,
      chatId,
      offset,
      limit,
      data: chatHistory
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
