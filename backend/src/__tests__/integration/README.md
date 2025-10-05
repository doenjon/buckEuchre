# Backend Integration Tests

Comprehensive integration tests for the Buck Euchre backend API and WebSocket functionality.

## Test Coverage

### Authentication Tests (`auth.test.ts`)
- Player creation via REST API
- JWT token generation and validation
- Input validation (empty names, long names, special characters)
- Concurrent player creation
- Error handling

### Game API Tests (`game-api.test.ts`)
- Game creation via REST API
- Game listing
- Game details retrieval
- Authentication middleware
- Concurrent game creation
- Error handling for invalid inputs

### WebSocket Tests (`websocket.test.ts`)
- Connection and authentication
- JOIN_GAME event handling
- GAME_STATE_UPDATE broadcasting
- Error handling for invalid events
- Disconnection and reconnection
- Event data validation
- Concurrent connections

### Full Game Flow Tests (`game-flow.test.ts`)
- Complete game flow: dealing → bidding → trump → folding → playing → scoring
- All players pass scenario (re-deal)
- Reconnection scenarios
- Dirty clubs scenario (no folding)
- Edge cases and rule validation

## Prerequisites

The backend server must be running before executing integration tests:

```bash
# Terminal 1: Start backend server
cd /workspace/backend
npm run dev
```

The server should be running on `http://localhost:3000` (or set `BACKEND_URL` environment variable).

## Running Tests

```bash
# Run all integration tests
npm test -- src/__tests__/integration

# Run specific test file
npm test -- src/__tests__/integration/auth.test.ts

# Run with verbose output
npm test -- src/__tests__/integration --verbose

# Run in watch mode
npm test -- src/__tests__/integration --watch

# Run with coverage
npm test -- src/__tests__/integration --coverage
```

## Test Environment

- **Test Framework:** Jest with ts-jest
- **HTTP Testing:** supertest
- **WebSocket Testing:** socket.io-client
- **Timeout:** Most tests use 10-60 second timeouts for full game flows

## Environment Variables

- `BACKEND_URL` - Backend server URL (default: `http://localhost:3000`)

## Test Database

Integration tests use the same database as the development environment. Consider:
- Using a separate test database
- Cleaning up test data after runs
- Using transactions that rollback

## Known Limitations

1. **Dirty Clubs Test:** Requires clubs to be randomly dealt as turn-up card
2. **Database State:** Tests may affect database state (consider cleanup)
3. **Server Dependency:** Requires backend server to be running
4. **Sequential Execution:** Some game flow tests should run sequentially

## Troubleshooting

### Tests Timeout
- Ensure backend server is running
- Check backend console for errors
- Increase timeout values if needed

### Connection Errors
- Verify `BACKEND_URL` is correct
- Check backend server is accepting connections
- Ensure no firewall blocking connections

### Database Errors
- Verify database is running
- Check Prisma schema is up to date
- Run migrations if needed

## CI/CD Integration

For automated testing:

```bash
# Start backend in background
npm run dev &
BACKEND_PID=$!

# Wait for server to be ready
sleep 5

# Run integration tests
npm test -- src/__tests__/integration

# Cleanup
kill $BACKEND_PID
```

## Test Maintenance

When adding new features:
1. Add corresponding integration tests
2. Update this README with new test coverage
3. Ensure tests are idempotent
4. Clean up resources in afterEach/afterAll hooks
