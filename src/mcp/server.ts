import { randomUUID } from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { IncomingMessage, ServerResponse } from 'http';
import { getUserView } from '../db/userView';
import { getUserById, createUser, getUserPersona } from '../db/user';
import { periskopeClient } from '../services/periskope';
import { getActivityVenueMapWithDetailsById, getActivityVenueMapsByCityAndDateTime } from '../db/activityVenueMap';

/**
 * Creates and configures the MCP server
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'whatsapp-bot-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {
          // Enable tools/list capability
          listChanged: true,
        },
      },
    }
  );

  // Helper function to log tool calls with query responses
  const logToolCall = (toolName: string, input: any, output: any, queryResponse?: any) => {
    const logData: any = { input, output };
    if (queryResponse !== undefined) {
      logData.queryResponse = queryResponse;
    }
    console.log(`Tool call: ${toolName}`, logData);
  };

  // Helper function to create error response
  const createErrorResponse = (error: string, message: string) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error, message }, null, 2),
      },
    ],
    isError: true,
  });

  // Helper function to create success response
  const createSuccessResponse = (data: any) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  });

  // Register tool: get_user_details (UserView with connections)
  server.registerTool(
    'get_user_details',
    {
      title: 'Get User Details',
      description: 'Fetches a UserView (user data with connections) by mobile number',
      inputSchema: {
        mobile_number: z.string().describe('Mobile number as a string (e.g., "1234567890")'),
      },
    },
    async ({ mobile_number }) => {
      const inputBody = { mobile_number };
      let outputBody: any;

      try {
        const userId = parseInt(mobile_number, 10);
        
        if (isNaN(userId)) {
          outputBody = createErrorResponse('Invalid mobile number', `"${mobile_number}" is not a valid numeric string`);
          logToolCall('get_user_details', inputBody, outputBody, null);
          return outputBody;
        }

        const userView = await getUserView(userId);

        if (!userView) {
          outputBody = createErrorResponse('User not found', `No user found with mobile number: ${mobile_number}`);
          logToolCall('get_user_details', inputBody, outputBody, null);
          return outputBody;
        }

        outputBody = createSuccessResponse(userView);
        logToolCall('get_user_details', inputBody, outputBody, userView);
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to fetch user view', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('get_user_details', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  // Register tool: create_user
  server.registerTool(
    'create_user',
    {
      title: 'Create User',
      description: 'Creates a new user with mobile number, name, and persona',
      inputSchema: {
        mobileNumber: z.number().describe('Mobile number as a number'),
        name: z.string().describe('User name as a string'),
        persona: z.string().describe('Persona JSON object as a string (e.g., \'{"key": "value"}\')'),
      },
    },
    async ({ mobileNumber, name, persona }) => {
      const inputBody = { mobileNumber, name, persona };
      let outputBody: any;

      try {
        // Check if user already exists
        const existingUser = await getUserById(mobileNumber);
        if (existingUser) {
          outputBody = createErrorResponse('User already exists', `User with mobile number ${mobileNumber} already exists`);
          logToolCall('create_user', inputBody, outputBody, existingUser);
          return outputBody;
        }

        // Parse persona JSON string
        let parsedPersona: any = null;
        if (persona) {
          try {
            parsedPersona = JSON.parse(persona);
            // Validate that parsed result is an object (not an array or primitive)
            if (typeof parsedPersona !== 'object' || parsedPersona === null || Array.isArray(parsedPersona)) {
              outputBody = createErrorResponse('Invalid persona', 'persona must be a valid JSON object string (not an array or primitive)');
              logToolCall('create_user', inputBody, outputBody, null);
              return outputBody;
            }
          } catch (error) {
            outputBody = createErrorResponse('Invalid JSON', `persona must be a valid JSON string: ${error instanceof Error ? error.message : 'Unknown error'}`);
            logToolCall('create_user', inputBody, outputBody, null);
            return outputBody;
          }
        }

        // Create the user
        const newUser = await createUser({
          user_id: mobileNumber,
          name: name,
          persona_json: parsedPersona,
        });

        outputBody = createSuccessResponse({
          success: true,
          message: 'User created successfully',
          user: {
            user_id: newUser.user_id,
            created_at: newUser.created_at,
            updated_at: newUser.updated_at,
            name: newUser.name,
            bio: newUser.bio,
            persona_json: newUser.persona_json,
            locality_id: newUser.locality_id,
            conversation_id: newUser.conversation_id,
          },
        });
        logToolCall('create_user', inputBody, outputBody, newUser);
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to create user', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('create_user', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  // Register tool: get_user
  server.registerTool(
    'get_user',
    {
      title: 'Get User',
      description: 'Fetches a user by mobile number (without connections)',
      inputSchema: {
        mobile_number: z.string().describe('Mobile number as a string (e.g., "1234567890")'),
      },
    },
    async ({ mobile_number }) => {
      const inputBody = { mobile_number };
      let outputBody: any;

      try {
        const userId = parseInt(mobile_number, 10);
        
        if (isNaN(userId)) {
          outputBody = createErrorResponse('Invalid mobile number', `"${mobile_number}" is not a valid numeric string`);
          logToolCall('get_user', inputBody, outputBody, null);
          return outputBody;
        }

        const user = await getUserById(userId);
        
        if (!user) {
          outputBody = createErrorResponse('User not found', `User with mobile number ${userId} not found`);
          logToolCall('get_user', inputBody, outputBody, null);
          return outputBody;
        }

        outputBody = createSuccessResponse({
          success: true,
          user: {
            user_id: user.user_id,
            created_at: user.created_at,
            updated_at: user.updated_at,
            name: user.name,
            bio: user.bio,
            persona_json: user.persona_json,
            locality_id: user.locality_id,
            conversation_id: user.conversation_id,
          },
        });
        logToolCall('get_user', inputBody, outputBody, user);
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to fetch user', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('get_user', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  // Register tool: get_user_persona
  server.registerTool(
    'get_user_persona',
    {
      title: 'Get User Persona',
      description: 'Fetches user persona by user ID',
      inputSchema: {
        userId: z.number().describe('User ID as a number'),
      },
    },
    async ({ userId }) => {
      const inputBody = { userId };
      let outputBody: any;

      try {
        const persona = await getUserPersona(userId);
        
        if (persona === null) {
          outputBody = createErrorResponse('Persona not found', `No persona found for user ID: ${userId}`);
          logToolCall('get_user_persona', inputBody, outputBody, null);
          return outputBody;
        }

        outputBody = createSuccessResponse({
          success: true,
          userId,
          persona,
        });
        logToolCall('get_user_persona', inputBody, outputBody, persona);
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to fetch user persona', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('get_user_persona', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  // Register tool: get_chat_messages
  server.registerTool(
    'get_chat_messages',
    {
      title: 'Get Chat Messages',
      description: 'Fetches chat history by chat ID with pagination',
      inputSchema: {
        chatId: z.string().describe('Chat ID (e.g., "919537851844@c.us")'),
        offset: z.number().optional().default(0).describe('Pagination offset (default: 0)'),
        limit: z.number().optional().default(2000).describe('Maximum number of messages to return (default: 2000)'),
      },
    },
    async ({ chatId, offset = 0, limit = 2000 }) => {
      const inputBody = { chatId, offset, limit };
      let outputBody: any;

      try {
        if (offset < 0) {
          outputBody = createErrorResponse('Invalid offset', 'offset must be a non-negative number');
          logToolCall('get_chat_messages', inputBody, outputBody, null);
          return outputBody;
        }

        if (limit < 1) {
          outputBody = createErrorResponse('Invalid limit', 'limit must be a positive number');
          logToolCall('get_chat_messages', inputBody, outputBody, null);
          return outputBody;
        }

        const chatHistory = await periskopeClient.getMessagesInChat(chatId, offset, limit);

        outputBody = createSuccessResponse({
          success: true,
          chatId,
          offset,
          limit,
          data: chatHistory,
        });
        logToolCall('get_chat_messages', inputBody, outputBody, chatHistory);
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to fetch chat messages', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('get_chat_messages', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  // Register tool: get_activity_venue_map
  server.registerTool(
    'get_activity_venue_map',
    {
      title: 'Get Activity Venue Map',
      description: 'Fetches activity venue map by ID with full details',
      inputSchema: {
        id: z.number().describe('Activity venue map ID'),
      },
    },
    async ({ id }) => {
      const inputBody = { id };
      let outputBody: any;

      try {
        const avm = await getActivityVenueMapWithDetailsById(id);
        
        if (!avm) {
          outputBody = createErrorResponse('Activity venue map not found', `Activity venue map with id ${id} not found`);
          logToolCall('get_activity_venue_map', inputBody, outputBody, null);
          return outputBody;
        }

        outputBody = createSuccessResponse({
          success: true,
          activityVenueMap: {
            id: avm.id,
            created_at: avm.created_at,
            activity_id: avm.activity_id,
            activity_name: avm.activity_name,
            activity_description: avm.activity_description,
            venue_id: avm.venue_id,
            venue_name: avm.venue_name,
            venue_address: avm.venue_address,
            venue_google_maps_location: avm.venue_google_maps_location,
            start_time: avm.start_time,
            end_time: avm.end_time,
            date: avm.date,
            is_active: avm.is_active,
            is_public: avm.is_public,
            is_hosted: avm.is_hosted,
            is_ticketed: avm.is_ticketed,
            ticket_price: avm.ticket_price,
            max_people: avm.max_people,
            parallel_slots: avm.parallel_slots,
            description: avm.description,
            img_url: avm.img_url,
            booking_link: avm.booking_link,
          },
        });
        logToolCall('get_activity_venue_map', inputBody, outputBody, avm);
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to fetch activity venue map', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('get_activity_venue_map', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  // Register tool: get_activity_venue_maps
  server.registerTool(
    'get_activity_venue_maps',
    {
      title: 'Get Activity Venue Maps',
      description: 'Fetches activity venue maps by city and datetime',
      inputSchema: {
        userId: z.number().describe('User ID to determine city location'),
        datetime: z.string().describe('ISO 8601 datetime string (e.g., "2024-01-15T18:00:00Z")'),
      },
    },
    async ({ userId, datetime }) => {
      const inputBody = { userId, datetime };
      let outputBody: any;

      try {
        // Validate datetime format
        const dateTime = new Date(datetime);
        if (isNaN(dateTime.getTime())) {
          outputBody = createErrorResponse('Invalid datetime', 'datetime must be a valid ISO 8601 datetime string');
          logToolCall('get_activity_venue_maps', inputBody, outputBody, null);
          return outputBody;
        }

        const results = await getActivityVenueMapsByCityAndDateTime(userId, datetime);

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

        outputBody = createSuccessResponse({
          success: true,
          userId,
          datetime,
          count: formattedResults.length,
          results: formattedResults,
        });
        logToolCall('get_activity_venue_maps', inputBody, outputBody, results);
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to fetch activity venue maps', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('get_activity_venue_maps', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  // Register tool: send_event_details
  server.registerTool(
    'send_event_details',
    {
      title: 'Send Event Details',
      description: 'Sends event details as WhatsApp message to user',
      inputSchema: {
        activityVenueMapId: z.number().describe('Activity venue map ID'),
        userId: z.number().describe('User ID to send message to'),
      },
    },
    async ({ activityVenueMapId, userId }) => {
      const inputBody = { activityVenueMapId, userId };
      let outputBody: any;

      try {
        // Get the activity venue map with full details
        const eventDetails = await getActivityVenueMapWithDetailsById(activityVenueMapId);
        
        if (!eventDetails) {
          outputBody = createErrorResponse('Activity venue map not found', `Activity venue map with id ${activityVenueMapId} not found`);
          logToolCall('send_event_details', inputBody, outputBody, null);
          return outputBody;
        }

        // Verify user exists
        const user = await getUserById(userId);
        if (!user) {
          outputBody = createErrorResponse('User not found', `User with id ${userId} not found`);
          logToolCall('send_event_details', inputBody, outputBody, { eventDetails, user: null });
          return outputBody;
        }

        // Format the event details message
        const formatDate = (date: Date | string): string => {
          const d = date instanceof Date ? date : new Date(date);
          return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        };

        const formatTime = (time: Date | string): string => {
          const t = time instanceof Date ? time : new Date(time);
          return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        const message = `🎉 *${eventDetails.activity_name}*

📅 *Date:* ${formatDate(eventDetails.date)}
⏰ *Time:* ${formatTime(eventDetails.start_time)} - ${formatTime(eventDetails.end_time)}

📍 *Venue:* ${eventDetails.venue_name}
${eventDetails.venue_address ? `📍 *Address:* ${eventDetails.venue_address}` : ''}
${eventDetails.venue_google_maps_location ? `🗺️ *Location:* ${eventDetails.venue_google_maps_location}` : ''}

📝 *Description:* ${eventDetails.description || eventDetails.activity_description || 'No description available'}

${eventDetails.is_ticketed ? `💰 *Ticket Price:* ${eventDetails.ticket_price ? `₹${eventDetails.ticket_price}` : 'Free'}` : '🆓 *Free Event*'}
${eventDetails.max_people ? `👥 *Max Capacity:* ${eventDetails.max_people} people` : ''}
${eventDetails.booking_link ? `🔗 *Book Now:* ${eventDetails.booking_link}` : ''}
${eventDetails.img_url ? `🖼️ *Image:* ${eventDetails.img_url}` : ''}

Hope to see you there! 🎊`;

        // Construct chatId from userId (format: <user_id>@c.us)
        const chatId = `${userId}@c.us`;

        // Send message via WhatsApp
        await periskopeClient.sendMessage(chatId, message);

        outputBody = createSuccessResponse({
          success: true,
          message: 'Event details sent successfully',
          activityVenueMapId,
          userId,
          chatId,
        });
        logToolCall('send_event_details', inputBody, outputBody, { eventDetails, user });
        return outputBody;
      } catch (error) {
        outputBody = createErrorResponse('Failed to send event details', error instanceof Error ? error.message : 'Unknown error');
        logToolCall('send_event_details', inputBody, outputBody, null);
        return outputBody;
      }
    }
  );

  return server;
}

/**
 * Gets the admin session ID from environment variables
 */
export function getAdminSessionId(): string | null {
  return process.env.MCP_ADMIN_SESSION_ID || null;
}

/**
 * Checks if a session ID is an admin session
 */
export function isAdminSession(sessionId: string | undefined | null): boolean {
  if (!sessionId) return false;
  const adminSessionId = getAdminSessionId();
  return adminSessionId !== null && sessionId === adminSessionId;
}

/**
 * Creates a streamable HTTP transport for the MCP server
 */
export function createMcpTransport(): StreamableHTTPServerTransport {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
}

/**
 * Sets up MCP server with streamable HTTP transport
 * Returns the server and transport instances
 */
export async function setupMcpServer(): Promise<{
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}> {
  const server = createMcpServer();
  const transport = createMcpTransport();

  await server.connect(transport);

  return { server, transport };
}

/**
 * Closes and resets the MCP server and transport
 * This should be called when a session is destroyed
 */
export async function resetMcpServer(
  server: McpServer | null,
  transport: StreamableHTTPServerTransport | null
): Promise<void> {
  // Disconnect server from transport first, then close transport
  // This ensures clean state reset
  if (server && transport) {
    await server.close();
  } else if (server) {
    await server.close();
  }
  
  // Close transport after server is disconnected
  if (transport) {
    await transport.close();
  }
}

/**
 * Handles an incoming MCP HTTP request
 * Admin sessions bypass all session checks and are always allowed
 */
export async function handleMcpRequest(
  transport: StreamableHTTPServerTransport,
  req: IncomingMessage | any,
  res: ServerResponse | any,
  parsedBody?: unknown
): Promise<void> {
  // Check if this is an admin session
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const isAdmin = isAdminSession(sessionId);
  
  if (isAdmin) {
    // Admin sessions bypass all checks - log for visibility
    console.log(`[ADMIN] Admin session request: ${sessionId}`);
  }
  
  // Express Response extends ServerResponse, so we can cast it directly
  // The transport expects Node.js IncomingMessage and ServerResponse
  // Express Request/Response are compatible, but TypeScript needs explicit casting
  const nodeReq = req as IncomingMessage;
  const nodeRes = res as ServerResponse;
  
  await transport.handleRequest(nodeReq, nodeRes, parsedBody);
}
