#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getUserPersona } from './db/user.js';
import { periskopeClient } from './services/periskope.js';
import { getActivityVenueMapsByCityAndDateTime } from './db/activityVenueMap.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a new MCP server instance
const server = new Server(
  {
    name: 'whatsapp-bot-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_user_persona',
        description: 'Fetch the persona data for a user by their user ID (contact number)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'number',
              description: 'The user ID (contact number) to fetch persona for',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'get_chat_history',
        description: 'Fetch all chat history with a user from Periskope API',
        inputSchema: {
          type: 'object',
          properties: {
            chatId: {
              type: 'string',
              description: 'The chat ID (e.g., "919537851844@c.us")',
            },
            offset: {
              type: 'number',
              description: 'Pagination offset (default: 0)',
              default: 0,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to return (default: 2000)',
              default: 2000,
            },
          },
          required: ['chatId'],
        },
      },
      {
        name: 'fetch_activity_venue_maps',
        description: 'Fetch activity venue maps happening at a given date and time in the same city as the user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'number',
              description: 'The user ID (contact number) to fetch activity venue maps for',
            },
            datetime: {
              type: 'string',
              description: 'ISO 8601 datetime string (e.g., "2024-01-15T18:00:00Z")',
            },
          },
          required: ['userId', 'datetime'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'echo') {
    return {
      content: [
        {
          type: 'text',
          text: `Echo: ${args?.message || 'No message provided'}`,
        },
      ],
    };
  }

  if (name === 'get_user_persona') {
    try {
      const userId = args?.userId;
      if (typeof userId !== 'number') {
        throw new Error('userId must be a number');
      }

      const persona = await getUserPersona(userId);
      
      if (persona === null) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: `No persona found for user ID: ${userId}`,
                  userId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                userId,
                persona,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === 'get_chat_history') {
    try {
      const chatId = args?.chatId;
      if (typeof chatId !== 'string') {
        throw new Error('chatId must be a string');
      }

      const offset = typeof args?.offset === 'number' ? args.offset : 0;
      const limit = typeof args?.limit === 'number' ? args.limit : 2000;

      const chatHistory = await periskopeClient.getMessagesInChat(chatId, offset, limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                chatId,
                offset,
                limit,
                data: chatHistory,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === 'fetch_activity_venue_maps') {
    try {
      const userId = args?.userId;
      const datetime = args?.datetime;

      if (typeof userId !== 'number') {
        throw new Error('userId must be a number');
      }

      if (typeof datetime !== 'string') {
        throw new Error('datetime must be a string');
      }

      console.log(`[MCP Tool Call] Executing fetch_activity_venue_maps`, {
        userId,
        datetime,
      });

      const results = await getActivityVenueMapsByCityAndDateTime(userId, datetime);

      // Format results for the response
      const formattedResults = results.map((avm) => ({
        id: avm.id,
        activity_id: avm.activity_id,
        venue_id: avm.venue_id,
        venue_name: avm.venue_name,
        venue_address: avm.venue_address,
        city_name: avm.city_name,
        date: avm.date,
        start_time: avm.start_time,
        end_time: avm.end_time,
        description: avm.description,
        max_people: avm.max_people,
        is_ticketed: avm.is_ticketed,
        ticket_price: avm.ticket_price,
        booking_link: avm.booking_link,
        img_url: avm.img_url,
      }));

      console.log(`[MCP Tool Call] Completed fetch_activity_venue_maps`, {
        userId,
        datetime,
        resultCount: formattedResults.length,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                userId,
                datetime,
                count: formattedResults.length,
                results: formattedResults,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error(`[MCP Tool Call] Error in fetch_activity_venue_maps:`, error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'whatsapp://health',
        name: 'Server Health',
        description: 'Get the health status of the WhatsApp bot server',
        mimeType: 'application/json',
      },
    ],
  };
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'whatsapp://health') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              status: 'ok',
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Start the server using streamable HTTP transport
async function main() {
  const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3001;
  const MCP_HOST = process.env.MCP_HOST || '0.0.0.0';

  // Create streamable HTTP transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  // Connect the server to the transport
  await server.connect(transport);

  // Create Express app
  const app = express();

  // Middleware for JSON parsing
  app.use(express.json());

  // MCP POST endpoint for requests
  app.post('/mcp', async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: req.body?.id || null,
        });
      }
    }
  });

  // MCP GET endpoint for SSE streams
  app.get('/mcp', async (req, res) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP SSE request:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'mcp-server',
      timestamp: new Date().toISOString(),
    });
  });

  // Start the HTTP server
  app.listen(MCP_PORT, MCP_HOST, () => {
    console.error(`MCP Server running on HTTP`);
    console.error(`Server: http://${MCP_HOST}:${MCP_PORT}`);
    console.error(`MCP endpoint: http://${MCP_HOST}:${MCP_PORT}/mcp`);
    console.error(`Health check: http://${MCP_HOST}:${MCP_PORT}/health`);
  });
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});

