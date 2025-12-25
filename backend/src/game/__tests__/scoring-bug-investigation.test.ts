/**
 * Test to investigate the scoring bug reported in screenshot
 *
 * Bug Report:
 * - Round 5: All players at 15
 * - Round 6: Jon=18 (+3), Rex=13 (-2), Pickles=34 (+19), Zoom=19 (+4)
 * - Zoom bid 3
 * - Trump: Spades
 * - Jon "got bucked" (should be +5 but was +3)
 * - Pickles "should have gone down, not up by 19"
 *
 * Analysis:
 * - Valid score changes are: -5 to -1 (took tricks), 0 (folded), +5 (bucked)
 * - +3, +19, +4 are all IMPOSSIBLE
 * - This suggests a fundamental bug in score calculation or application
 */

import { calculateRoundScores } from '../scoring';
import { Player, PlayerPosition } from '../../../../shared/src/types/game';

describe('Scoring Bug Investigation', () => {
  const createPlayer = (position: PlayerPosition, tricksTaken: number, folded: boolean, score: number = 15): Player => ({
    id: `player${position}`,
    name: ['Jon', 'Rex', 'Pickles', 'Zoom'][position],
    position,
    score,
    connected: true,
    hand: [],
    tricksTaken,
    folded,
    foldDecision: folded ? 'FOLD' : 'STAY',
  });

  it('should investigate what tricks taken would produce the observed score changes', () => {
    // Let's try different combinations to see if we can reproduce the bug
    console.log('\n=== INVESTIGATING SCORING BUG ===\n');

    // Scenario 1: Zoom (bidder) bid 3, let's say took 3 tricks (made bid)
    // Rex took 2 tricks (got -2) ✓
    // Remaining tricks: 5 - 3 - 2 = 0 for Jon and Pickles
    const scenario1 = [
      createPlayer(0, 0, false), // Jon - took 0 tricks, should be +5 (bucked)
      createPlayer(1, 2, false), // Rex - took 2 tricks, should be -2
      createPlayer(2, 0, false), // Pickles - took 0 tricks, should be +5 (bucked)
      createPlayer(3, 3, false), // Zoom - bidder, took 3 tricks, should be -3
    ];

    const scores1 = calculateRoundScores(scenario1, 3, 3, false);
    console.log('Scenario 1 (Zoom bid 3, made bid):');
    console.log('  Jon (0 tricks):    expected +5, calculated:', scores1[0]);
    console.log('  Rex (2 tricks):    expected -2, calculated:', scores1[1]);
    console.log('  Pickles (0 tricks): expected +5, calculated:', scores1[2]);
    console.log('  Zoom (bidder, 3):  expected -3, calculated:', scores1[3]);
    console.log('');

    // Check if this matches the bug
    const bugReportChanges = [+3, -2, +19, +4];
    console.log('Bug report changes:', bugReportChanges);
    console.log('Calculated changes:', [scores1[0], scores1[1], scores1[2], scores1[3]]);
    console.log('Match:', JSON.stringify([scores1[0], scores1[1], scores1[2], scores1[3]]) === JSON.stringify(bugReportChanges));
    console.log('');

    // Scenario 2: What if player indices don't match positions?
    console.log('Scenario 2: Testing if player.position !== array index causes mismatch');
    const scenario2 = [
      { ...createPlayer(2, 0, false), position: 2 as PlayerPosition }, // Array index 0, but position 2
      { ...createPlayer(0, 2, false), position: 0 as PlayerPosition }, // Array index 1, but position 0
      { ...createPlayer(3, 0, false), position: 3 as PlayerPosition }, // Array index 2, but position 3
      { ...createPlayer(1, 3, false), position: 1 as PlayerPosition }, // Array index 3, but position 1
    ];

    const scores2 = calculateRoundScores(scenario2, 1, 3, false); // Bidder is position 1 (array index 3)
    console.log('With mismatched indices:');
    console.log('  Player at index 0 (pos 2):', scores2[0]);
    console.log('  Player at index 1 (pos 0):', scores2[1]);
    console.log('  Player at index 2 (pos 3):', scores2[2]);
    console.log('  Player at index 3 (pos 1, bidder):', scores2[3]);
    console.log('');
  });

  it('should test if scoreChanges Record access could cause issues', () => {
    console.log('\n=== TESTING Record<number, number> ACCESS ===\n');

    const players = [
      createPlayer(0, 0, false),
      createPlayer(1, 2, false),
      createPlayer(2, 0, false),
      createPlayer(3, 3, false),
    ];

    const scoreChanges = calculateRoundScores(players, 3, 3, false);

    console.log('typeof scoreChanges:', typeof scoreChanges);
    console.log('scoreChanges:', scoreChanges);
    console.log('Object.keys(scoreChanges):', Object.keys(scoreChanges));
    console.log('');

    // Test different ways of accessing
    console.log('scoreChanges[0]:', scoreChanges[0]);
    console.log('scoreChanges["0"]:', scoreChanges["0" as any]);
    console.log('scoreChanges.0:', (scoreChanges as any).0);
    console.log('');

    // Test if all indices are defined
    for (let i = 0; i < 4; i++) {
      console.log(`scoreChanges[${i}] = ${scoreChanges[i]} (type: ${typeof scoreChanges[i]})`);
    }
  });

  it('should verify calculateRoundScores always returns valid changes', () => {
    console.log('\n=== VERIFYING ALL SCORE CHANGES ARE VALID ===\n');

    // Valid score changes: -5, -4, -3, -2, -1, 0, +5
    const validChanges = new Set([-5, -4, -3, -2, -1, 0, 5]);

    // Test many random scenarios
    for (let test = 0; test < 100; test++) {
      const players = [];
      let totalTricks = 0;

      for (let i = 0; i < 4; i++) {
        const folded = Math.random() < 0.2; // 20% chance of folding
        const tricks = folded ? 0 : Math.floor(Math.random() * 6);
        totalTricks += tricks;
        players.push(createPlayer(i as PlayerPosition, tricks, folded));
      }

      // Normalize tricks to sum to 5
      if (totalTricks > 5) {
        const scale = 5 / totalTricks;
        let remaining = 5;
        for (let i = 0; i < 4; i++) {
          if (!players[i].folded) {
            const scaled = Math.floor(players[i].tricksTaken * scale);
            players[i].tricksTaken = i === 3 ? remaining : scaled;
            remaining -= players[i].tricksTaken;
          }
        }
      }

      const bidder = Math.floor(Math.random() * 4) as PlayerPosition;
      const bid = (Math.floor(Math.random() * 4) + 2) as 2 | 3 | 4 | 5;

      const scoreChanges = calculateRoundScores(players as any, bidder, bid, false);

      for (let i = 0; i < 4; i++) {
        if (!validChanges.has(scoreChanges[i])) {
          console.error(`INVALID SCORE CHANGE DETECTED in test ${test}!`);
          console.error(`  Player ${i}: ${scoreChanges[i]}`);
          console.error(`  Players:`, players.map(p => ({ tricks: p.tricksTaken, folded: p.folded })));
          console.error(`  Bidder: ${bidder}, Bid: ${bid}`);
          throw new Error(`Invalid score change: ${scoreChanges[i]}`);
        }
      }
    }

    console.log('✓ All 100 random scenarios produced valid score changes');
  });
});
