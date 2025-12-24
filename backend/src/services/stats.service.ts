/**
 * Stats service for tracking and retrieving game statistics
 */

import { prisma } from '../db/client';

export interface RoundStatsUpdate {
  userId: string;
  wasBidder: boolean;
  bidAmount?: number;
  bidSuccess?: boolean;
  tricksWon: number;
  totalTricks: number;
  pointsEarned: number;
  folded?: boolean;
  couldFold?: boolean;
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
  const { userId, wasBidder, bidAmount, bidSuccess, tricksWon, totalTricks, pointsEarned, folded, couldFold } = roundStats;

  console.log('[updateRoundStats] Called for user', userId, 'with stats:', {
    wasBidder,
    bidAmount,
    bidSuccess,
    tricksWon,
    totalTricks,
    pointsEarned,
  });

  try {
    // Get current stats
    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      console.error(`[updateRoundStats] Stats not found for user ${userId}`);
      return;
    }

    console.log('[updateRoundStats] Current stats for user', userId, ':', {
      gamesPlayed: stats.gamesPlayed,
      totalTricks: stats.totalTricks,
      tricksWon: stats.tricksWon,
      totalPoints: stats.totalPoints,
    });

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

    console.log('[updateRoundStats] Applying updates for user', userId, ':', updates);

    // Update stats
    await prisma.userStats.update({
      where: { userId },
      data: updates,
    });

    console.log('[updateRoundStats] Successfully updated stats for user', userId);
  } catch (error) {
    console.error('[updateRoundStats] Error updating round stats:', error);
    throw error;
  }
}

/**
 * Update user stats after a game completes
 */
export async function updateGameStats(gameStats: GameStatsUpdate): Promise<void> {
  const { userId, won, finalScore } = gameStats;

  console.log('[updateGameStats] Called for user', userId, 'with stats:', {
    won,
    finalScore,
  });

  try {
    // Get current stats
    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      console.error(`[updateGameStats] Stats not found for user ${userId}`);
      return;
    }

    console.log('[updateGameStats] Current stats for user', userId, ':', {
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      gamesLost: stats.gamesLost,
    });

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

    console.log('[updateGameStats] Applying updates for user', userId, ':', updates);

    // Update stats
    await prisma.userStats.update({
      where: { userId },
      data: updates,
    });

    console.log('[updateGameStats] Successfully updated stats for user', userId);
  } catch (error) {
    console.error('[updateGameStats] Error updating game stats:', error);
    throw error;
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

  const averagePoints = stats.totalRounds > 0
    ? stats.totalPoints / stats.totalRounds
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
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' | 'totalRounds' | 'foldRate' | 'bucks' | 'tricksWon' | 'avgPointsPerGame',
  limit: number = 50
) {
  const allStats = await prisma.userStats.findMany({
    where: {
      gamesPlayed: {
        gte: 1, // Require at least 1 game played
      },
      user: {
        // Filter out AI players (usernames starting with "AI_")
        username: {
          not: {
            startsWith: 'AI_',
          },
        },
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

  // Filter out AI players (safety check - also filtered in query above)
  const nonAIStats = allStats.filter(stat => 
    stat.user && !stat.user.username.startsWith('AI_')
  );

  // Calculate computed metrics
  const statsWithMetrics = nonAIStats.map(stat => {
    const winRate = stat.gamesPlayed > 0 
      ? (stat.gamesWon / stat.gamesPlayed) * 100 
      : 0;

    const bidSuccessRate = stat.totalBids > 0
      ? (stat.successfulBids / stat.totalBids) * 100
      : 0;

    const foldRate = stat.timesCouldFold > 0
      ? (stat.timesFolded / stat.timesCouldFold) * 100
      : 0;

    const avgPointsPerGame = stat.totalRounds > 0
      ? stat.totalPoints / stat.totalRounds
      : 0;

    return {
      ...stat,
      winRate: Math.round(winRate * 10) / 10,
      bidSuccessRate: Math.round(bidSuccessRate * 10) / 10,
      foldRate: Math.round(foldRate * 10) / 10,
      avgPointsPerGame: Math.round(avgPointsPerGame * 10) / 10,
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
    } else if (metric === 'totalRounds') {
      return b.totalRounds - a.totalRounds;
    } else if (metric === 'foldRate') {
      // Require at least 5 opportunities to fold for meaningful comparison
      const aHasEnough = a.timesCouldFold >= 5;
      const bHasEnough = b.timesCouldFold >= 5;
      
      // Players with less than 5 opportunities go to the end
      if (!aHasEnough && !bHasEnough) {
        // Both don't have enough - sort by foldRate among themselves (lower is better)
        return Number(a.foldRate || 0) - Number(b.foldRate || 0);
      }
      if (!aHasEnough) return 1;
      if (!bHasEnough) return -1;
      
      // Both have enough opportunities - sort ascending (lower is better)
      return Number(a.foldRate) - Number(b.foldRate);
    } else if (metric === 'bucks') {
      return b.bucks - a.bucks;
    } else if (metric === 'tricksWon') {
      return b.tricksWon - a.tricksWon;
    } else if (metric === 'avgPointsPerGame') {
      // Require at least 10 rounds for meaningful comparison
      const aHasEnough = a.totalRounds >= 10;
      const bHasEnough = b.totalRounds >= 10;

      // Players with less than 10 rounds go to the end
      if (!aHasEnough && !bHasEnough) {
        // Both don't have enough - sort by avgPointsPerGame among themselves (higher is better)
        return Number(b.avgPointsPerGame || 0) - Number(a.avgPointsPerGame || 0);
      }
      if (!aHasEnough) return 1;
      if (!bHasEnough) return -1;

      // Both have enough rounds - sort descending (higher is better)
      return Number(b.avgPointsPerGame) - Number(a.avgPointsPerGame);
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
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' | 'totalRounds' | 'foldRate' | 'bucks' | 'tricksWon' | 'avgPointsPerGame'
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
      user: {
        // Filter out AI players (usernames starting with "AI_")
        username: {
          not: {
            startsWith: 'AI_',
          },
        },
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

  // Filter out AI players (safety check - also filtered in query above)
  const nonAIStats = stats.filter(stat => 
    stat.user && !stat.user.username.startsWith('AI_')
  );

  // Calculate computed metrics
  const statsWithMetrics = nonAIStats.map(stat => {
    const winRate = stat.gamesPlayed > 0 
      ? (stat.gamesWon / stat.gamesPlayed) * 100 
      : 0;

    const bidSuccessRate = stat.totalBids > 0
      ? (stat.successfulBids / stat.totalBids) * 100
      : 0;

    const foldRate = stat.timesCouldFold > 0
      ? (stat.timesFolded / stat.timesCouldFold) * 100
      : 0;

    const avgPointsPerGame = stat.totalRounds > 0
      ? stat.totalPoints / stat.totalRounds
      : 0;

    return {
      ...stat,
      winRate: Math.round(winRate * 10) / 10,
      bidSuccessRate: Math.round(bidSuccessRate * 10) / 10,
      foldRate: Math.round(foldRate * 10) / 10,
      avgPointsPerGame: Math.round(avgPointsPerGame * 10) / 10,
    };
  });

  // Sort by metric
  statsWithMetrics.sort((a, b) => {
    if (metric === 'gamesWon') {
      return b.gamesWon - a.gamesWon;
    } else if (metric === 'winRate') {
      // Require at least 1 game for win rate comparison
      if (a.gamesPlayed < 1) return 1;
      if (b.gamesPlayed < 1) return -1;
      return b.winRate - a.winRate;
    } else if (metric === 'totalPoints') {
      return b.totalPoints - a.totalPoints;
    } else if (metric === 'bidSuccessRate') {
      // Require at least 1 bid for bid success rate comparison
      if (a.totalBids < 1) return 1;
      if (b.totalBids < 1) return -1;
      return b.bidSuccessRate - a.bidSuccessRate;
    } else if (metric === 'totalRounds') {
      return b.totalRounds - a.totalRounds;
    } else if (metric === 'foldRate') {
      // Require at least 5 opportunities to fold for meaningful comparison
      const aHasEnough = a.timesCouldFold >= 5;
      const bHasEnough = b.timesCouldFold >= 5;
      
      // Players with less than 5 opportunities go to the end
      if (!aHasEnough && !bHasEnough) {
        // Both don't have enough - sort by foldRate among themselves (lower is better)
        return Number(a.foldRate || 0) - Number(b.foldRate || 0);
      }
      if (!aHasEnough) return 1;
      if (!bHasEnough) return -1;
      
      // Both have enough opportunities - sort ascending (lower is better)
      return Number(a.foldRate) - Number(b.foldRate);
    } else if (metric === 'bucks') {
      return b.bucks - a.bucks;
    } else if (metric === 'tricksWon') {
      return b.tricksWon - a.tricksWon;
    } else if (metric === 'avgPointsPerGame') {
      // Require at least 10 rounds for meaningful comparison
      const aHasEnough = a.totalRounds >= 10;
      const bHasEnough = b.totalRounds >= 10;

      // Players with less than 10 rounds go to the end
      if (!aHasEnough && !bHasEnough) {
        // Both don't have enough - sort by avgPointsPerGame among themselves (higher is better)
        return Number(b.avgPointsPerGame || 0) - Number(a.avgPointsPerGame || 0);
      }
      if (!aHasEnough) return 1;
      if (!bHasEnough) return -1;

      // Both have enough rounds - sort descending (higher is better)
      return Number(b.avgPointsPerGame) - Number(a.avgPointsPerGame);
    }
    return 0;
  });

  return statsWithMetrics;
}



