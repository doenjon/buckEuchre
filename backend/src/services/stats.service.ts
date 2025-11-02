/**
 * Stats service for tracking and retrieving game statistics
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RoundStatsUpdate {
  userId: string;
  wasBidder: boolean;
  bidAmount?: number;
  bidSuccess?: boolean;
  tricksWon: number;
  totalTricks: number;
  pointsEarned: number;
}

export interface GameStatsUpdate {
  userId: string;
  won: boolean;
  finalScore: number;
}

/**
 * Update user stats after a round completes
 */
export async function updateRoundStats(roundStats: RoundStatsUpdate): Promise<void> {
  const { userId, wasBidder, bidAmount, bidSuccess, tricksWon, totalTricks, pointsEarned } = roundStats;

  try {
    // Get current stats
    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      console.error(`Stats not found for user ${userId}`);
      return;
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
    await prisma.userStats.update({
      where: { userId },
      data: updates,
    });
  } catch (error) {
    console.error('Error updating round stats:', error);
  }
}

/**
 * Update user stats after a game completes
 */
export async function updateGameStats(gameStats: GameStatsUpdate): Promise<void> {
  const { userId, won, finalScore } = gameStats;

  try {
    // Get current stats
    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      console.error(`Stats not found for user ${userId}`);
      return;
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
    await prisma.userStats.update({
      where: { userId },
      data: updates,
    });
  } catch (error) {
    console.error('Error updating game stats:', error);
  }
}

/**
 * Get user stats by user ID
 */
export async function getUserStats(userId: string) {
  return prisma.userStats.findUnique({
    where: { userId },
  });
}

/**
 * Get computed stats including win rate, bid success rate, etc.
 */
export async function getComputedStats(userId: string) {
  const stats = await getUserStats(userId);

  if (!stats) {
    return null;
  }

  const winRate = stats.gamesPlayed > 0 
    ? (stats.gamesWon / stats.gamesPlayed) * 100 
    : 0;

  const bidSuccessRate = stats.totalBids > 0
    ? (stats.successfulBids / stats.totalBids) * 100
    : 0;

  const trickWinRate = stats.totalTricks > 0
    ? (stats.tricksWon / stats.totalTricks) * 100
    : 0;

  const averagePoints = stats.gamesPlayed > 0
    ? stats.totalPoints / stats.gamesPlayed
    : 0;

  return {
    ...stats,
    winRate: Math.round(winRate * 10) / 10,
    bidSuccessRate: Math.round(bidSuccessRate * 10) / 10,
    trickWinRate: Math.round(trickWinRate * 10) / 10,
    averagePoints: Math.round(averagePoints * 10) / 10,
  };
}

/**
 * Get leaderboard by a specific metric
 */
export async function getLeaderboard(
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate',
  limit: number = 50
) {
  const allStats = await prisma.userStats.findMany({
    where: {
      gamesPlayed: {
        gte: 5, // Require at least 5 games played
      },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isGuest: false,
        },
      },
    },
  });

  // Calculate computed metrics
  const statsWithMetrics = allStats.map(stat => {
    const winRate = stat.gamesPlayed > 0 
      ? (stat.gamesWon / stat.gamesPlayed) * 100 
      : 0;

    const bidSuccessRate = stat.totalBids > 0
      ? (stat.successfulBids / stat.totalBids) * 100
      : 0;

    return {
      ...stat,
      winRate: Math.round(winRate * 10) / 10,
      bidSuccessRate: Math.round(bidSuccessRate * 10) / 10,
    };
  });

  // Sort by metric
  statsWithMetrics.sort((a, b) => {
    if (metric === 'gamesWon') {
      return b.gamesWon - a.gamesWon;
    } else if (metric === 'winRate') {
      return b.winRate - a.winRate;
    } else if (metric === 'totalPoints') {
      return b.totalPoints - a.totalPoints;
    } else if (metric === 'bidSuccessRate') {
      return b.bidSuccessRate - a.bidSuccessRate;
    }
    return 0;
  });

  // Take top N
  return statsWithMetrics.slice(0, limit);
}

/**
 * Get friends leaderboard
 */
export async function getFriendsLeaderboard(
  userId: string,
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate'
) {
  // Get user's friends
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' },
        { receiverId: userId, status: 'ACCEPTED' },
      ],
    },
  });

  // Extract friend IDs
  const friendIds = friendships.map(f => 
    f.requesterId === userId ? f.receiverId : f.requesterId
  );

  // Add the user themselves
  friendIds.push(userId);

  // Get stats for friends and user
  const stats = await prisma.userStats.findMany({
    where: {
      userId: {
        in: friendIds,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Calculate computed metrics
  const statsWithMetrics = stats.map(stat => {
    const winRate = stat.gamesPlayed > 0 
      ? (stat.gamesWon / stat.gamesPlayed) * 100 
      : 0;

    const bidSuccessRate = stat.totalBids > 0
      ? (stat.successfulBids / stat.totalBids) * 100
      : 0;

    return {
      ...stat,
      winRate: Math.round(winRate * 10) / 10,
      bidSuccessRate: Math.round(bidSuccessRate * 10) / 10,
    };
  });

  // Sort by metric
  statsWithMetrics.sort((a, b) => {
    if (metric === 'gamesWon') {
      return b.gamesWon - a.gamesWon;
    } else if (metric === 'winRate') {
      // Require at least 5 games for win rate comparison
      if (a.gamesPlayed < 5) return 1;
      if (b.gamesPlayed < 5) return -1;
      return b.winRate - a.winRate;
    } else if (metric === 'totalPoints') {
      return b.totalPoints - a.totalPoints;
    } else if (metric === 'bidSuccessRate') {
      // Require at least 5 bids for bid success rate comparison
      if (a.totalBids < 5) return 1;
      if (b.totalBids < 5) return -1;
      return b.bidSuccessRate - a.bidSuccessRate;
    }
    return 0;
  });

  return statsWithMetrics;
}

