# WhatsApp Bot Server

TypeScript server application for WhatsApp bot functionality using Periskope integration.

## Features

- ✅ Webhook event handling for all Periskope webhook events
- ✅ Automatic user profile initialization for 1:1 chats
- ✅ PostgreSQL database integration
- ✅ Webhook signature verification
- ✅ TypeScript with full type safety

## Setup

1. Copy the environment template and configure:
```bash
cp env.template .env
# Edit .env with your actual values
```

2. Set up your PostgreSQL database and run the schema:
```bash
# Create database and run the schema from db_schema file
psql -U your_user -d whatsapp_bot -f db_schema
```

3. Install dependencies:
```bash
npm install
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

## Development

For development with hot reload:
```bash
npm run dev
```

For development with auto-restart on file changes:
```bash
npm run dev:watch
```

To watch for changes and rebuild:
```bash
npm run watch
```

## Server Endpoints

- `GET /health` - Health check endpoint
- `POST /webhook` - Webhook endpoint for receiving Periskope events

## Webhook Events

The server handles all Periskope webhook events:
- `chat.created` - Initializes user profiles for 1:1 chats (@c.us)
- `chat.notification.created`
- `message.created`
- `message.updated`
- `message.deleted`
- `message.ack.updated`
- `message.ticket.attached`
- `reaction.created`
- `reaction.updated`
- `ticket.created`
- `ticket.updated`
- `ticket.deleted`
- `message.flagged`
- `message.unflagged`
- `org.phone.updated`
- `org.phone.connected`
- `org.phone.disconnected`
- `org.phone.qr`
- `note.created`
- `chat.custom_properties.updated`

## Core Functionality

### User Profile Initialization

When a `chat.created` webhook event is received:
1. The server checks if the `chat_id` ends with `@c.us` (indicating a 1:1 chat)
2. If it's a 1:1 chat, extracts the user ID (contact number) from the chat_id
3. Checks if a user profile already exists in the database
4. If not, creates a new user profile with the contact number as `user_id`

## Environment Variables

See `env.template` for required environment variables:
- `PERISKOPE_API_KEY` - Your Periskope API key
- `PERISKOPE_PHONE_NUMBER` - Your Periskope phone number
- `PERISKOPE_SIGNING_KEY` - Webhook signing key for signature verification
- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_SSL` - Set to 'true' if using SSL (default: false)
- `PORT` - Server port (default: 3000)

## Project Structure

```
src/
├── db/              # Database connection and operations
│   ├── connection.ts
│   └── user.ts
├── handlers/        # Webhook event handlers
│   └── webhookEventHandlers.ts
├── services/        # External service clients
│   └── periskope.ts
├── types/           # TypeScript type definitions
│   ├── database.ts
│   └── webhook.ts
├── utils/           # Utility functions
│   └── webhook.ts
└── index.ts         # Main server file
```

## Documentation

- Periskope API: https://docs.periskope.app/api-reference/introduction
- Periskope Webhooks: https://docs.periskope.app/api-reference/webhooks/introduction
