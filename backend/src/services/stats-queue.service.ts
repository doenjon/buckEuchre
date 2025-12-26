/**
 * @module services/stats-queue
 * @description Queue-based stats persistence with retry logic
 * 
 * Ensures stats are persisted reliably with:
 * - Atomic transactions (all-or-nothing)
 * - Automatic retries on failure
 * - Deduplication (no duplicate stats)
 * - Graceful degradation (logs errors without blocking gameplay)
 */

import { prisma } from '../db/client.js';
import { RoundStatsUpdate, GameStatsUpdate } from './stats.service.js';

interface StatsTask {
  gameId: string;
  roundNumber: number;
  timestamp: number;
  updates: RoundStatsUpdate[];
  gameUpdates?: GameStatsUpdate[];
  retries: number;
}

/**
 * Queue for reliably persisting stats
 */
export class StatsQueue {
  private queue = new Map<string, StatsTask>();
  private processing = new Set<string>();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  /**
   * Enqueue stats to persist
   * 
   * @param task - Stats task to persist
   */
  public async enqueue(task: Omit<StatsTask, 'retries'>): Promise<void> {
    const key = `${task.gameId}-${task.roundNumber}`;
    
    // Check if already in queue (deduplication)
    if (this.queue.has(key)) {
      console.log(`[Stats Queue] Task ${key} already queued, skipping duplicate`);
      return;
    }

    const taskWithRetries: StatsTask = {
      ...task,
      retries: 0,
    };

    this.queue.set(key, taskWithRetries);
    console.log(`[Stats Queue] Enqueued ${key} with ${task.updates.length} round updates and ${task.gameUpdates?.length || 0} game updates`);
    console.log(`[Stats Queue] Round updates:`, task.updates.map(u => ({ userId: u.userId, tricksWon: u.tricksWon, wasBidder: u.wasBidder })));
    
    // Process immediately (but don't block)
    setImmediate(() => this.process(key));
  }

  /**
   * Process stats task with retries
   * 
   * @param key - Task key
   */
  private async process(key: string): Promise<void> {
    if (this.processing.has(key)) {
      console.log(`[Stats Queue] Task ${key} already being processed`);
      return; // Already processing
    }
    
    const task = this.queue.get(key);
    if (!task) {
      console.warn(`[Stats Queue] Task ${key} not found in queue`);
      return;
    }
    
    this.processing.add(key);
    console.log(`[Stats Queue] Processing ${key} (attempt ${task.retries + 1}/${this.MAX_RETRIES})`);
    
    try {
      // Execute all updates in a transaction
      await prisma.$transaction(async (tx) => {
        // Process round stats updates
        for (const update of task.updates) {
          await this.updateRoundStatsInTx(tx, update);
        }
        
        // Process game stats updates (if present)
        if (task.gameUpdates) {
          for (const update of task.gameUpdates) {
            await this.updateGameStatsInTx(tx, update);
          }
        }
      });
      
      // Success - remove from queue
      this.queue.delete(key);
      this.processing.delete(key);
      console.log(`[Stats Queue] Completed ${key} successfully`);
      
    } catch (error) {
      this.processing.delete(key);
      console.error(`[Stats Queue] Failed ${key} (attempt ${task.retries + 1}):`, error);
      
      // Retry logic
      task.retries++;
      if (task.retries < this.MAX_RETRIES) {
        // Retry after exponential backoff delay
        const delay = this.RETRY_DELAY_MS * task.retries;
        console.log(`[Stats Queue] Will retry ${key} in ${delay}ms`);
        setTimeout(() => this.process(key), delay);
      } else {
        // Give up after max retries
        console.error(`[Stats Queue] Gave up on ${key} after ${this.MAX_RETRIES} retries`);
        this.queue.delete(key);
      }
    }
  }

  /**
   * Update round stats within a transaction
   * 
   * @param tx - Prisma transaction client
   * @param update - Round stats update
   */
  private async updateRoundStatsInTx(
    tx: any,
    update: RoundStatsUpdate
  ): Promise<void> {
    const { userId, wasBidder, bidAmount, bidSuccess, tricksWon, totalTricks, pointsEarned, folded, couldFold } = update;

    console.log(`[Stats Queue] Updating round stats for user ${userId}:`, { tricksWon, totalTricks, pointsEarned, wasBidder, folded, couldFold });

    // Get current stats, create if they don't exist
    let stats = await tx.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      console.log(`[Stats Queue] Stats not found for user ${userId}, creating new stats record`);
      try {
        stats = await tx.userStats.create({
          data: {
            userId,
          },
        });
        console.log(`[Stats Queue] Created stats record for user ${userId}`);
      } catch (error) {
        console.error(`[Stats Queue] Failed to create stats for user ${userId}:`, error);
        throw error;
      }
    }

    // Calculate updates
    const updates: any = {
      totalRounds: stats.totalRounds + 1, // Increment for every round played
      totalTricks: stats.totalTricks + totalTricks,
      tricksWon: stats.tricksWon + tricksWon,
      totalPoints: stats.totalPoints + pointsEarned,
    };

    // Track bucks: when pointsEarned === -5, player got bucked (scoreChange was +5)
    // This is consistent: negative pointsEarned means you got bucked
    if (pointsEarned === -5) {
      updates.bucks = (stats.bucks || 0) + 1;
    }

    // Track fold stats
    if (couldFold) {
      updates.timesCouldFold = (stats.timesCouldFold || 0) + 1;
      if (folded) {
        updates.timesFolded = (stats.timesFolded || 0) + 1;
      }
    }

    // Update bidding stats if user was the bidder
    // totalBids = total number of times you were the winning bidder (denominator)
    //   - Only counts actual bids (not Dirty Clubs, where there's no bidding)
    // successfulBids = number of times you made your bid (numerator)
    //   - Only counts when you successfully made your bid
    if (wasBidder && bidAmount !== undefined && bidSuccess !== undefined) {
      // Only increment totalBids when there was an actual bid (not Dirty Clubs)
      // bidAmount is only set when !isClubsTurnUp, so this excludes Dirty Clubs
      updates.totalBids = stats.totalBids + 1;
      
      if (bidSuccess) {
        updates.successfulBids = stats.successfulBids + 1;
      } else {
        updates.failedBids = stats.failedBids + 1;
      }

      // Update highest bid
      if (bidAmount > stats.highestBid) {
        updates.highestBid = bidAmount;
      }

      // Track bid amounts separately with success/failure
      if (bidAmount === 2) {
        updates.bids2 = (stats.bids2 || 0) + 1;
        if (bidSuccess) {
          updates.bids2Successful = (stats.bids2Successful || 0) + 1;
        } else {
          updates.bids2Failed = (stats.bids2Failed || 0) + 1;
        }
      } else if (bidAmount === 3) {
        updates.bids3 = (stats.bids3 || 0) + 1;
        if (bidSuccess) {
          updates.bids3Successful = (stats.bids3Successful || 0) + 1;
        } else {
          updates.bids3Failed = (stats.bids3Failed || 0) + 1;
        }
      } else if (bidAmount === 4) {
        updates.bids4 = (stats.bids4 || 0) + 1;
        if (bidSuccess) {
          updates.bids4Successful = (stats.bids4Successful || 0) + 1;
        } else {
          updates.bids4Failed = (stats.bids4Failed || 0) + 1;
        }
      } else if (bidAmount === 5) {
        updates.bids5 = (stats.bids5 || 0) + 1;
        if (bidSuccess) {
          updates.bids5Successful = (stats.bids5Successful || 0) + 1;
        } else {
          updates.bids5Failed = (stats.bids5Failed || 0) + 1;
        }
      }
    }

    // Update stats
    await tx.userStats.update({
      where: { userId },
      data: updates,
    });

    console.log(`[Stats Queue] Updated round stats for user ${userId}`);
  }

  /**
   * Update game stats within a transaction
   * 
   * @param tx - Prisma transaction client
   * @param update - Game stats update
   */
  private async updateGameStatsInTx(
    tx: any,
    update: GameStatsUpdate
  ): Promise<void> {
    const { userId, won, finalScore } = update;

    console.log(`[Stats Queue] Updating game stats for user ${userId}:`, { won, finalScore });

    // Get current stats, create if they don't exist
    let stats = await tx.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      console.log(`[Stats Queue] Stats not found for user ${userId}, creating new stats record`);
      try {
        stats = await tx.userStats.create({
          data: {
            userId,
          },
        });
        console.log(`[Stats Queue] Created stats record for user ${userId}`);
      } catch (error) {
        console.error(`[Stats Queue] Failed to create stats for user ${userId}:`, error);
        throw error;
      }
    }

    // Calculate updates
    const updates: any = {
      gamesPlayed: stats.gamesPlayed + 1,
    };

    if (won) {
      updates.gamesWon = stats.gamesWon + 1;
    } else {
      updates.gamesLost = stats.gamesLost + 1;
    }

    // Update highest score
    if (finalScore > stats.highestScore) {
      updates.highestScore = finalScore;
    }

    // Update stats
    await tx.userStats.update({
      where: { userId },
      data: updates,
    });

    console.log(`[Stats Queue] Updated game stats for user ${userId}`);
  }

  /**
   * Get queue status for monitoring
   * 
   * @returns Queue status
   */
  public getStatus(): { queueSize: number; processing: number } {
    return {
      queueSize: this.queue.size,
      processing: this.processing.size,
    };
  }

  /**
   * Flush all pending tasks (call on graceful shutdown)
   * 
   * @returns Promise that resolves when all tasks complete
   */
  public async flush(): Promise<void> {
    console.log(`[Stats Queue] Flushing ${this.queue.size} pending tasks...`);
    
    const promises = Array.from(this.queue.keys()).map(key => this.process(key));
    
    await Promise.allSettled(promises);
    
    console.log(`[Stats Queue] Flush complete`);
  }
}

// Singleton instance
export const statsQueue = new StatsQueue();

