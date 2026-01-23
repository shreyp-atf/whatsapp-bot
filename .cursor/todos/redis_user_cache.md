# Redis Cache for User and Agent Conversation IDs

## Objective
Create a Redis cache to store user-to-agent conversation ID mappings to enable fast user existence validation and conversation ID lookups.

## Benefits
- Fast user existence checks without database queries
- Quick access to conversation IDs for different agents
- Reduced database load
- Improved response times for message processing

## Implementation Details

### Cache Structure
- Key format: `user:{userId}` or `user:{userId}:conversations`
- Value: JSON object containing:
  - `user_id`: number
  - `conversation_id`: string (Master Agent conversation)
  - `agent_conversation_ids`: object mapping agent names to conversation IDs
    - Example: `{ "onboarding": "conv_123", "planning": "conv_456" }`
  - `exists`: boolean (for quick existence checks)

### Operations Needed
1. **Set user cache** - When user is created or updated
2. **Get user cache** - Check user existence and get conversation IDs
3. **Invalidate cache** - When user is updated or deleted
4. **TTL** - Set appropriate expiration time (e.g., 24 hours)

### Integration Points
- `handleChatCreated()` - Cache user when created
- `handleMessageCreated()` - Check cache before database lookup
- `conversationManager.ts` - Use cache for conversation ID lookups
- `db/user.ts` - Invalidate cache on user updates

### Considerations
- Cache invalidation strategy (write-through vs write-behind)
- Handling cache misses (fallback to database)
- Cache warming on startup (optional)
- Monitoring cache hit/miss rates

## Status
- [ ] Design cache structure
- [ ] Set up Redis client/connection
- [ ] Implement cache set operations
- [ ] Implement cache get operations
- [ ] Implement cache invalidation
- [ ] Integrate with user creation flow
- [ ] Integrate with message processing flow
- [ ] Add error handling for cache failures
- [ ] Add monitoring/logging
- [ ] Performance testing
