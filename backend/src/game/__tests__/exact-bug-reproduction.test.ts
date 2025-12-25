/**
 * Test to reproduce the exact bug from the screenshot
 *
 * Screenshot shows:
 * Round 5: Jon=15, Rex=15, Pickles=15, Zoom=15
 * Round 6: Jon=18, Rex=13, Pickles=34, Zoom=19
 *
 * Changes: Jon +3, Rex -2, Pickles +19, Zoom +4
 *
 * User states:
 * - Zoom was bidder and bid 3
 * - Trump was Spades
 * - Jon "got bucked" (should be +5, but was +3)
 * - Pickles "should have gone down, not up"
 *
 * Analysis:
 * - If Zoom bid 3 and took 3 tricks: -3 (shows +4 ❌)
 * - If Jon got bucked (0 tricks): +5 (shows +3 ❌)
 * - If Rex took 2 tricks: -2 (shows -2 ✓ CORRECT!)
 * - If Pickles took 0 tricks: +5 (shows +19 ❌)
 *
 * Rex is the ONLY correct score! This suggests a systematic bug
 * where scores are being applied to wrong players or accumulated incorrectly.
 */

import { calculateRoundScores, checkWinCondition } from '../scoring';
import { Player, PlayerPosition } from '../../../../shared/src/types/game';

describe('Exact Bug Reproduction from Screenshot', () => {
  const createPlayer = (
    position: PlayerPosition,
    name: string,
    tricksTaken: number,
    folded: boolean,
    score: number = 15
  ): Player => ({
    id: `player${position}`,
    name,
    position,
    score,
    connected: true,
    hand: [],
    tricksTaken,
    folded,
    foldDecision: folded ? 'FOLD' : 'STAY',
  });

  it('should reproduce the exact scenario from screenshot', () => {
    // Based on Rex being correct with -2, Rex took 2 tricks
    // Zoom bid 3, so if Zoom took 3 tricks, that's 5 total
    // That means Jon and Pickles took 0 tricks each (got bucked)

    const players = [
      createPlayer(0, 'Jon', 0, false, 15),      // 0 tricks, should get +5
      createPlayer(1, 'Rex', 2, false, 15),      // 2 tricks, should get -2
      createPlayer(2, 'Pickles', 0, false, 15),  // 0 tricks, should get +5
      createPlayer(3, 'Zoom', 3, false, 15),     // 3 tricks (bidder), should get -3
    ];

    const scoreChanges = calculateRoundScores(players, 3, 3, false);

    console.log('\n=== EXPECTED SCORES ===');
    console.log('Jon (0 tricks, non-bidder):     +5 → 20');
    console.log('Rex (2 tricks, non-bidder):     -2 → 13');
    console.log('Pickles (0 tricks, non-bidder): +5 → 20');
    console.log('Zoom (3 tricks, bidder bid 3):  -3 → 12');

    console.log('\n=== CALCULATED SCORES ===');
    console.log(`Jon:     ${scoreChanges[0] >= 0 ? '+' : ''}${scoreChanges[0]} → ${15 + scoreChanges[0]}`);
    console.log(`Rex:     ${scoreChanges[1] >= 0 ? '+' : ''}${scoreChanges[1]} → ${15 + scoreChanges[1]}`);
    console.log(`Pickles: ${scoreChanges[2] >= 0 ? '+' : ''}${scoreChanges[2]} → ${15 + scoreChanges[2]}`);
    console.log(`Zoom:    ${scoreChanges[3] >= 0 ? '+' : ''}${scoreChanges[3]} → ${15 + scoreChanges[3]}`);

    console.log('\n=== ACTUAL SCORES FROM SCREENSHOT ===');
    console.log('Jon:     +3 → 18');
    console.log('Rex:     -2 → 13');
    console.log('Pickles: +19 → 34');
    console.log('Zoom:    +4 → 19');

    // Verify expected behavior
    expect(scoreChanges[0]).toBe(5);   // Jon should get +5
    expect(scoreChanges[1]).toBe(-2);  // Rex should get -2 ✓
    expect(scoreChanges[2]).toBe(5);   // Pickles should get +5
    expect(scoreChanges[3]).toBe(-3);  // Zoom should get -3

    console.log('\n=== BUG ANALYSIS ===');
    console.log('Rex is CORRECT (-2), but all others are wrong!');
    console.log('This suggests scores are being:');
    console.log('1. Applied to wrong player positions');
    console.log('2. Accumulated from multiple sources');
    console.log('3. Corrupted during state management');
  });

  it('should test if player ID mismatch could cause the bug', () => {
    console.log('\n=== TESTING PLAYER ID MISMATCH SCENARIO ===');

    // What if the players array is ordered by name instead of position?
    const playersOrderedByName = [
      createPlayer(0, 'Jon', 0, false, 15),
      createPlayer(2, 'Pickles', 0, false, 15),
      createPlayer(1, 'Rex', 2, false, 15),
      createPlayer(3, 'Zoom', 3, false, 15),
    ];

    // This should throw an error with our new validation
    expect(() => {
      calculateRoundScores(playersOrderedByName, 3, 3, false);
    }).toThrow('Array indices must match player positions');

    console.log('✓ Player position mismatch is now caught by validation');
  });
});
