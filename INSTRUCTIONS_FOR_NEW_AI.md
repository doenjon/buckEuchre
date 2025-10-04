# Instructions for AI Agent - Buck Euchre Project

## Current Status

**Phases 1-5: COMPLETE** ✅
- ✅ Foundation (types, constants, DB schema)
- ✅ Game Logic (all pure functions implemented & tested)
- ✅ Backend Services (player, game, state management)
- ✅ Backend API (REST + WebSocket handlers)
- ✅ Frontend UI (React components, all features)

**Phase 5.5: IN PROGRESS** 🚧
- ✅ Integration test framework created
- ❌ Need to run tests and fix bugs revealed

---

## Your Mission

**Run the automated tests and fix any bugs they reveal.**

The integration test framework can test the entire game automatically without manual clicking. It simulates 4 real players via WebSocket and plays through complete games.

---

## Step-by-Step Instructions

### 1. Read the Testing Guide

**File:** `TESTING_GUIDE.md`

This explains:
- How the test framework works
- How to run tests
- How to interpret results
- How to fix bugs found

### 2. Check Current Test Status

```bash
cd ~/dev/BuchEuchre/backend/tests/integration
npm test game-flow.test.ts
```

**Expected:** All 5 tests should pass ✅
- These test basic game setup (join, create, state sync)

### 3. Run Full Game Tests

```bash
cd ~/dev/BuchEuchre/backend/tests/integration  
npm test full-game.test.ts
```

**Expected:** Tests will reveal bugs in game logic

The test simulates a complete game:
- Deal → Bid → Trump → Fold → Play 5 tricks → Score

It will fail at whichever phase has bugs.

### 4. Fix Bugs

**For each failing test:**

a) Read the error message
b) Check backend logs: `tail -100 /tmp/backend.log`
c) Identify the bug in backend code
d) Fix the bug
e) Restart backend if you changed code:
   ```bash
   # In backend terminal
   # Ctrl+C to stop, then:
   npm run dev
   ```
f) Re-run the test
g) Repeat until that test passes

### 5. Document Fixes

After fixing bugs, update:
- `PROGRESS.md` - Mark tasks complete
- Git commit with clear message explaining the fix

---

## Known Issues to Expect

Based on previous testing, you'll likely find:

1. **Phase transition bugs** - Game might not auto-advance between phases
2. **Validation issues** - Invalid moves might be accepted
3. **Scoring bugs** - Points calculated incorrectly
4. **Edge cases** - All players pass, dirty clubs, etc.

**This is expected!** The tests are designed to find these bugs.

---

## Important Files

### Test Files
- `backend/tests/integration/game-flow.test.ts` - Basic tests (passing)
- `backend/tests/integration/full-game.test.ts` - Full game tests (needs work)

### Game Logic (likely where bugs are)
- `backend/src/game/state.ts` - State transitions
- `backend/src/game/validation.ts` - Move validation
- `backend/src/game/scoring.ts` - Score calculation
- `backend/src/game/trick.ts` - Trick winner determination

### WebSocket Handlers (might have bugs)
- `backend/src/sockets/game.ts` - Game action handlers

### Services (might have bugs)
- `backend/src/services/game.service.ts` - Game management
- `backend/src/services/state.service.ts` - State management

---

## Debugging Tips

### 1. Read Test Output Carefully

Tests have detailed console logging:
```
📋 Phase: DEALING
  Player 0: 5 cards
  Player 1: 5 cards
  Turn-up card: KING of HEARTS
  
💰 Phase: BIDDING  
  Dealer: Player 2
  Alice bids 3
  Bob passes
```

### 2. Check Backend Logs

```bash
tail -f /tmp/backend.log
```

Look for:
- Error messages
- Prisma query errors
- Stack traces

### 3. Inspect Game State

The test stores game state in `player.gameState`. Add logging:
```typescript
console.log('Current phase:', player.gameState.phase);
console.log('Current bidder:', player.gameState.currentBidder);
```

### 4. Use Existing Tests as Examples

Look at `game-flow.test.ts` for examples of working tests.

---

## Success Criteria

Phase 5.5 is complete when:

✅ All tests in `game-flow.test.ts` pass (already done)
✅ All tests in `full-game.test.ts` pass
✅ Can play a complete game from start to finish via tests
✅ Edge cases handled (all players pass, dirty clubs, etc.)

---

## Next Steps After Phase 5.5

Once all tests pass, move to:
- **Phase 6:** Error Handling & Reconnection
- **Phase 7:** UI Polish & Full Lobby  
- **Phase 8:** Production Testing
- **Phase 9:** Deployment

---

## Getting Help

If stuck:
1. Re-read `TESTING_GUIDE.md`
2. Check `GAME_STATE_SPEC.md` for how game logic should work
3. Check `BUCK_EUCHRE_RULES.md` for game rules
4. Look at existing unit tests in `backend/src/game/__tests__/`

---

## Quick Reference

### Restart Backend
```bash
cd ~/dev/BuchEuchre/backend
# Ctrl+C to stop
npm run dev
```

### Run All Tests
```bash
cd ~/dev/BuchEuchre/backend/tests/integration
npm test
```

### Run Specific Test
```bash
npm test full-game.test.ts
```

### Check Backend Health
```bash
curl http://localhost:3000/health
```

### View Logs
```bash
tail -50 /tmp/backend.log
```

---

**Good luck! The framework is solid. Just run the tests and fix what they find. 🚀**

