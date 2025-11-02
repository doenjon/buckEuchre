# Bug Fix: Incorrect Euchre Scoring When Clubs Turn Up

## Issue Description

When "dirt clubs" (clubs turned up) occurred, the player to the left of the dealer was incorrectly being treated as a "bidder" and scored with bidder rules. This meant:

- If that player got 1 trick (less than the hardcoded bid of 2), they would get +5 (euchred)
- They should have been scored as a non-bidder and gotten -1

## Root Cause

When clubs is the turn-up card:
1. Bidding is skipped entirely (per Buck Euchre rules)
2. There is NO bidder - all players should be scored as non-bidders
3. However, the code was setting `winningBidderPosition` to the player left of dealer
4. The scoring function then treated that player as a bidder who failed their contract

## Files Changed

### 1. `/workspace/backend/src/game/scoring.ts`
- Modified `calculateRoundScores()` function signature to accept `isClubsTurnUp` parameter
- Changed `winningBidderPosition` parameter type from `PlayerPosition` to `PlayerPosition | null`
- Added logic to skip bidder scoring when `isClubsTurnUp` is true
- All players are now scored as non-bidders when clubs is turned up

### 2. `/workspace/backend/src/game/state.ts`
- Updated two calls to `calculateRoundScores()` to pass `state.isClubsTurnUp` parameter
- Line 374-378: When all non-bidders fold
- Line 530-534: Normal round completion

### 3. `/workspace/backend/src/game/__tests__/scoring.test.ts`
- Added comprehensive test suite for "Clubs Turn-Up (No Bidder) Scenario"
- 4 new test cases verifying correct scoring behavior:
  1. All players scored as non-bidders when clubs turned up
  2. Player with 1 trick gets -1 (NOT +5/euchred)
  3. All players taking tricks get -tricksTaken
  4. Players with 0 tricks still get +5 penalty

## Test Results

✅ All 18 scoring tests pass (including 4 new clubs turn-up tests)
✅ All 48 state transition tests pass
✅ No linter errors

## Scoring Logic Summary

### Normal Bidding (isClubsTurnUp = false)
- **Bidder made contract**: -tricksTaken
- **Bidder failed contract**: +5 (euchred)
- **Non-bidder took 1+ tricks**: -tricksTaken
- **Non-bidder took 0 tricks**: +5 (got set)

### Clubs Turn-Up (isClubsTurnUp = true)
- **ALL players scored as non-bidders**
- **Player took 1+ tricks**: -tricksTaken
- **Player took 0 tricks**: +5 (got set)

## Example

Before fix (INCORRECT):
- Clubs turned up, player left of dealer gets 1 trick
- Scored as bidder: 1 < 2 → +5 (euchred) ❌

After fix (CORRECT):
- Clubs turned up, player left of dealer gets 1 trick  
- Scored as non-bidder: 1 ≥ 1 → -1 ✅

## Related Files
- Buck Euchre Rules: `/workspace/BUCK_EUCHRE_RULES.md` (lines 61-62, 173-175)
- Game State Spec: `/workspace/GAME_STATE_SPEC.md`
