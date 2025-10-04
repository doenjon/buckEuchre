# Integration Tests

WebSocket-based integration tests that simulate real players joining and playing games.

## Setup

```bash
cd backend/tests/integration
npm install
```

## Running Tests

**Prerequisites:** Backend server must be running on `http://localhost:3000`

```bash
# In terminal 1: Start backend
cd backend
npm run dev

# In terminal 2: Run integration tests
cd backend/tests/integration
npm test
```

## What These Tests Do

1. **Connect via WebSocket** - Simulates Socket.IO client connections
2. **Authenticate Players** - Creates 4 players with names
3. **Create and Join Game** - Tests game creation and joining flow
4. **Verify Game Start** - Checks that game initializes correctly
5. **Test Error Handling** - Validates edge cases (invalid game ID, too many players, etc.)

## Test Output

Tests will show:
- ✅ Success messages for each step
- 📊 Game state information (phase, round, dealer)
- ❌ Detailed errors if anything fails

## Debugging

If tests fail:
1. Check backend console for errors
2. Look at test output for which step failed
3. Each test has detailed console logging

## Test Files

- `game-flow.test.ts` - Main integration tests
- `setup.ts` - Test configuration
- `jest.config.js` - Jest configuration
- `package.json` - Dependencies

