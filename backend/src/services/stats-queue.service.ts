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

import { PrismaClient } from '@prisma/client';
import { RoundStatsUpdate, GameStatsUpdate } from './stats.service';

const prisma = new PrismaClient();

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
    const { userId, wasBidder, bidAmount, bidSuccess, tricksWon, totalTricks, pointsEarned } = update;

    // Get current stats
    const stats = await tx.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      throw new Error(`Stats not found for user ${userId}`);
    }

    // Calculate updates
    const updates: any = {
      totalTricks: stats.totalTricks + totalTricks,
      tricksWon: stats.tricksWon + tricksWon,
      totalPoints: stats.totalPoints + pointsEarned,
    };

    // Update bidding stats if user was the bidder
    if (wasBidder && bidAmount !== undefined && bidSuccess !== undefined) {
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

    // Get current stats
    const stats = await tx.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      throw new Error(`Stats not found for user ${userId}`);
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

