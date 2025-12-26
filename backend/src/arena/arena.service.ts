/**
 * Arena Service - Main orchestration for AI battles
 *
 * Handles:
 * - Config initialization
 * - Match scheduling
 * - ELO rating updates
 * - Statistics aggregation
 */

import { prisma } from '../db/client.js';
import type { ArenaConfig, ArenaMatch, MatchResult, ArenaStats, MatchLauncherOptions } from './types.js';
import type { AIDifficulty } from '../ai/types.js';
import { ARENA_CONFIGS, DEFAULT_ELO_RATING } from './configs.js';
import { calculateEloUpdates, findSimilarRatings } from './elo.service.js';
import { runHeadlessGame } from './game-runner.service.js';

/**
 * Initialize arena configs in database
 *
 * Creates all predefined configs if they don't exist.
 * Called on server startup.
 */
export async function initializeArenaConfigs(): Promise<void> {
  console.log('[Arena] Initializing arena configs...');

  for (const config of ARENA_CONFIGS) {
    const existing = await prisma.arenaConfig.findUnique({
      where: { id: config.id },
    });

    if (!existing) {
      await prisma.arenaConfig.create({
        data: {
          id: config.id,
          name: config.name,
          provider: config.provider,
          difficulty: config.difficulty,
          paramsJson: config.params || undefined,
          eloRating: DEFAULT_ELO_RATING,
          gamesPlayed: 0,
        },
      });
      console.log(`[Arena] Created config: ${config.name}`);
    }
  }

  console.log('[Arena] Config initialization complete');
}

/**
 * Get all arena configs
 */
export async function getAllConfigs(): Promise<ArenaConfig[]> {
  const configs = await prisma.arenaConfig.findMany({
    orderBy: {
      eloRating: 'desc',
    },
  });

  return configs.map((c) => ({
    ...c,
    difficulty: c.difficulty as AIDifficulty,
    params: c.paramsJson as Record<string, any> | undefined,
  }));
}

/**
 * Get config by ID
 */
export async function getConfigById(id: string): Promise<ArenaConfig | null> {
  const config = await prisma.arenaConfig.findUnique({
    where: { id },
  });

  if (!config) return null;

  return {
    ...config,
    difficulty: config.difficulty as AIDifficulty,
    params: config.paramsJson as Record<string, any> | undefined,
  };
}

/**
 * Run a single match and record results
 *
 * @param configIds - Array of 4 config IDs (in position order)
 * @returns Match record with results
 */
export async function runMatch(configIds: string[]): Promise<ArenaMatch> {
  if (configIds.length !== 4) {
    throw new Error('Exactly 4 configs required for a match');
  }

  // Load configs
  const configs = await Promise.all(configIds.map((id) => getConfigById(id)));

  if (configs.some((c) => !c)) {
    throw new Error('One or more configs not found');
  }

  // Create match record
  const match = await prisma.arenaMatch.create({
    data: {
      status: 'IN_PROGRESS',
    },
  });

  console.log(`[Arena] Starting match ${match.id} with configs: ${configIds.join(', ')}`);

  try {
    // Run headless game
    const result = await runHeadlessGame(configs as ArenaConfig[]);

    if (result.error) {
      // Mark match as error
      await prisma.arenaMatch.update({
        where: { id: match.id },
        data: {
          status: 'ERROR',
          completedAt: new Date(),
        },
      });

      throw new Error(`Game error: ${result.error}`);
    }

    // Calculate ELO updates
    const matchResults: MatchResult[] = result.participants.map((p) => ({
      configId: p.configId,
      position: p.position,
      finalScore: p.finalScore,
    }));

    const currentRatings = new Map<string, number>();
    for (const config of configs as ArenaConfig[]) {
      currentRatings.set(config.id, config.eloRating);
    }

    const eloUpdates = calculateEloUpdates(matchResults, currentRatings);

    // Update database with results
    await prisma.$transaction(async (tx) => {
      // Create participants
      for (const update of eloUpdates) {
        const participant = result.participants.find((p) => p.configId === update.configId)!;

        await tx.arenaParticipant.create({
          data: {
            matchId: match.id,
            configId: update.configId,
            position: participant.position,
            finalScore: participant.finalScore,
            eloRatingBefore: update.oldRating,
            eloRatingAfter: update.newRating,
            eloChange: update.change,
          },
        });

        // Update config ELO and games played
        await tx.arenaConfig.update({
          where: { id: update.configId },
          data: {
            eloRating: update.newRating,
            gamesPlayed: {
              increment: 1,
            },
          },
        });
      }

      // Mark match complete
      await tx.arenaMatch.update({
        where: { id: match.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    });

    console.log(`[Arena] Match ${match.id} completed. Duration: ${result.duration}ms`);

    // Log ELO changes
    for (const update of eloUpdates) {
      const sign = update.change >= 0 ? '+' : '';
      console.log(
        `[Arena]   ${update.configId}: ${update.oldRating.toFixed(1)} → ${update.newRating.toFixed(1)} (${sign}${update.change.toFixed(1)})`
      );
    }

    // Return updated match with participants
    const updatedMatch = await prisma.arenaMatch.findUnique({
      where: { id: match.id },
      include: {
        participants: true,
      },
    });

    return updatedMatch as ArenaMatch;
  } catch (error: any) {
    console.error(`[Arena] Error in match ${match.id}:`, error.message);

    // Mark match as error
    await prisma.arenaMatch.update({
      where: { id: match.id },
      data: {
        status: 'ERROR',
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Run multiple matches
 *
 * @param options - Match launcher options
 * @returns Array of match results
 */
export async function runMatches(options: MatchLauncherOptions): Promise<ArenaMatch[]> {
  const { numGames, mode, configIds } = options;

  if (mode === 'manual') {
    // Manual mode - use provided config IDs
    if (!configIds || configIds.length !== 4) {
      throw new Error('Manual mode requires exactly 4 config IDs');
    }

    const matches: ArenaMatch[] = [];

    for (let i = 0; i < numGames; i++) {
      console.log(`[Arena] Running manual match ${i + 1}/${numGames}`);
      const match = await runMatch(configIds);
      matches.push(match);
    }

    return matches;
  } else if (mode === 'elo') {
    // ELO mode - pair configs based on similar ratings
    const matches: ArenaMatch[] = [];

    for (let i = 0; i < numGames; i++) {
      console.log(`[Arena] Running ELO match ${i + 1}/${numGames}`);

      // Select 4 configs based on ELO
      const selectedConfigIds = await selectConfigsByELO();

      const match = await runMatch(selectedConfigIds);
      matches.push(match);
    }

    return matches;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

/**
 * Select 4 configs based on ELO matchmaking
 *
 * Tries to pair configs with similar ratings for competitive matches.
 */
async function selectConfigsByELO(): Promise<string[]> {
  const allConfigs = await getAllConfigs();

  if (allConfigs.length < 4) {
    throw new Error('Not enough configs available for ELO matchmaking');
  }

  // Randomly select a base config
  const baseConfig = allConfigs[Math.floor(Math.random() * allConfigs.length)];

  // Find 3 others with similar ratings
  const allRatings = new Map<string, number>();
  allConfigs.forEach((c) => allRatings.set(c.id, c.eloRating));

  const similar = findSimilarRatings(baseConfig.eloRating, allRatings, 300);

  // Remove base config from similar list
  const others = similar.filter((id) => id !== baseConfig.id);

  // Take first 3, or pad with random configs if not enough
  let selectedIds = [baseConfig.id];

  if (others.length >= 3) {
    // Shuffle and take 3
    const shuffled = others.sort(() => Math.random() - 0.5);
    selectedIds.push(...shuffled.slice(0, 3));
  } else {
    // Not enough similar - just add what we have and fill with random
    selectedIds.push(...others);

    const remaining = allConfigs
      .map((c) => c.id)
      .filter((id) => !selectedIds.includes(id));

    const shuffled = remaining.sort(() => Math.random() - 0.5);
    selectedIds.push(...shuffled.slice(0, 4 - selectedIds.length));
  }

  // Shuffle final positions
  return selectedIds.sort(() => Math.random() - 0.5);
}

/**
 * Get recent matches
 */
export async function getRecentMatches(limit: number = 20): Promise<ArenaMatch[]> {
  const matches = await prisma.arenaMatch.findMany({
    where: {
      status: 'COMPLETED',
    },
    include: {
      participants: {
        include: {
          config: true,
        },
      },
    },
    orderBy: {
      completedAt: 'desc',
    },
    take: limit,
  });

  return matches as any;
}

/**
 * Get arena statistics for all configs
 */
export async function getArenaStats(): Promise<ArenaStats[]> {
  const configs = await getAllConfigs();

  const stats = await Promise.all(
    configs.map(async (config) => {
      // Get all participations
      const participants = await prisma.arenaParticipant.findMany({
        where: {
          configId: config.id,
          match: {
            status: 'COMPLETED',
          },
        },
      });

      if (participants.length === 0) {
        return {
          configId: config.id,
          name: config.name,
          eloRating: config.eloRating,
          gamesPlayed: 0,
          avgScore: 0,
          winRate: 0,
        };
      }

      // Calculate avg score
      const totalScore = participants.reduce((sum, p) => sum + p.finalScore, 0);
      const avgScore = totalScore / participants.length;

      // Calculate win rate (how often did this config finish 1st?)
      // We need to compare final scores within each match
      let wins = 0;

      for (const participant of participants) {
        // Get all participants in this match
        const matchParticipants = await prisma.arenaParticipant.findMany({
          where: { matchId: participant.matchId },
        });

        const maxScore = Math.max(...matchParticipants.map((p) => p.finalScore));
        if (participant.finalScore === maxScore) {
          wins++;
        }
      }

      const winRate = (wins / participants.length) * 100;

      return {
        configId: config.id,
        name: config.name,
        eloRating: config.eloRating,
        gamesPlayed: participants.length,
        avgScore,
        winRate,
      };
    })
  );

  return stats.sort((a, b) => b.eloRating - a.eloRating);
}
