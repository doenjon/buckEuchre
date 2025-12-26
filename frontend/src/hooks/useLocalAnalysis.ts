/**
 * @module hooks/useLocalAnalysis
 * @description Client-side MCTS analysis with progress tracking and continuous analysis
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ISMCTSEngine } from '@/ai/ismcts';
import type { GameState, CardAnalysis } from '@buck-euchre/shared';

export interface AnalysisProgress {
  simulations: number;
  totalSimulations: number;
  progress: number; // 0-100
}

// Progressive analysis stages: 5k, 10k, 15k, 20k
const ANALYSIS_STAGES = [5000, 10000, 15000, 20000];

/**
 * Hook for running client-side MCTS analysis with progress tracking
 */
export function useLocalAnalysis() {
  const { gameState, myPosition, setAIAnalysis, nextPlayerPosition } = useGameStore();
  const [isThinking, setIsThinking] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const analysisRef = useRef<{ gameStateId: string; position: number; abortController: AbortController } | null>(null);

  const runAnalysis = useCallback(async (
    state: GameState,
    position: number,
    abortController: AbortController,
    onProgress?: (progress: AnalysisProgress) => void
  ) => {
    // Only analyze during PLAYING phase
    if (state.phase !== 'PLAYING') {
      return null;
    }

    const player = state.players[position];
    if (!player || !player.hand || player.hand.length === 0) {
      return null;
    }

    setIsThinking(true);

    try {
      let cumulativeSimulations = 0;

      // Helper to convert results to CardAnalysis format
      const convertToCardAnalysis = (results: Record<string, any>): CardAnalysis[] => {
        const entries = Object.entries(results);

        // Sort by expected score (negative is better) to compute ranks
        const sorted = [...entries].sort(([, a], [, b]) => a.value - b.value);
        const ranks = new Map(sorted.map(([cardId], index) => [cardId, index + 1]));

        return entries.map(([cardId, stats]) => ({
          cardId,
          expectedScore: stats.value,
          visits: stats.visits,
          winProbability: 0, // Not computed in flat MCTS
          expectedTricks: 0, // Not computed in flat MCTS
          confidence: stats.confidence ?
            Math.min(1, stats.visits / 1000) : // Confidence based on visit count
            Math.min(1, stats.visits / 1000),
          rank: ranks.get(cardId) || 0,
          buckProbability: stats.buckProbability || 0,
          confidenceInterval: stats.confidence ? {
            lower: stats.confidence.lower,
            upper: stats.confidence.upper,
            width: stats.confidence.upper - stats.confidence.lower
          } : undefined,
        }));
      };

      // Run progressive analysis through each stage
      for (const targetSimulations of ANALYSIS_STAGES) {
        // Check if analysis was aborted
        if (abortController.signal.aborted) {
          console.log(`[useLocalAnalysis] Analysis aborted at ${cumulativeSimulations} simulations`);
          break;
        }

        const simulationsForThisStage = targetSimulations - cumulativeSimulations;

        const engine = new ISMCTSEngine({
          simulations: simulationsForThisStage,
          verbose: false,
        });

        // Update progress to show current stage
        setProgress({
          simulations: cumulativeSimulations,
          totalSimulations: targetSimulations,
          progress: Math.round((cumulativeSimulations / targetSimulations) * 100)
        });

        // Run analysis with progress callbacks and intermediate results
        const results = await engine.analyzeHandWithProgress(
          state,
          position as any,
          (simulations: number) => {
            const totalSims = cumulativeSimulations + simulations;
            const progressPercent = Math.round((totalSims / targetSimulations) * 100);
            const progressInfo = {
              simulations: totalSims,
              totalSimulations: targetSimulations,
              progress: progressPercent
            };
            setProgress(progressInfo);
            onProgress?.(progressInfo);
          },
          (intermediateResults) => {
            // Update UI with intermediate results every 1000 simulations
            if (!abortController.signal.aborted) {
              const cardAnalysis = convertToCardAnalysis(intermediateResults);
              setAIAnalysis(cardAnalysis);
            }
          }
        );

        // Update cumulative count
        cumulativeSimulations = targetSimulations;

        // Set final results for this stage
        if (!abortController.signal.aborted) {
          const cardAnalysis = convertToCardAnalysis(results);
          setAIAnalysis(cardAnalysis);
        }

        // Brief pause between stages
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return null; // Results are already set via setAIAnalysis
    } catch (error) {
      console.error('[useLocalAnalysis] Analysis failed:', error);
      return null;
    } finally {
      setIsThinking(false);
      setProgress(null);
    }
  }, [setAIAnalysis]);

  // Auto-trigger analysis when it's my turn
  useEffect(() => {
    if (!gameState || myPosition === null) {
      return;
    }

    // Check if it's my turn (either current turn or next turn during trick pause)
    const isMyCurrentTurn =
      gameState.phase === 'PLAYING' &&
      gameState.currentPlayerPosition === myPosition;

    const isMyNextTurn =
      gameState.phase === 'PLAYING' &&
      nextPlayerPosition === myPosition;

    const shouldAnalyze = isMyCurrentTurn || isMyNextTurn;

    if (!shouldAnalyze) {
      // Clear analysis when not my turn and abort ongoing analysis
      if (analysisRef.current) {
        analysisRef.current.abortController.abort();
        setAIAnalysis(null);
        analysisRef.current = null;
      }
      return;
    }

    // Create a unique ID for this game state + position combination
    // Include nextPlayerPosition in the ID to ensure we run analysis during trick pause
    const stateId = `${gameState.gameId}-${gameState.version}-${gameState.phase}-${myPosition}-next:${nextPlayerPosition ?? 'none'}`;

    // Skip if we've already analyzed this exact state
    if (analysisRef.current?.gameStateId === stateId) {
      return;
    }

    // Abort previous analysis if running
    if (analysisRef.current) {
      analysisRef.current.abortController.abort();
    }

    // Create new abort controller for this analysis
    const abortController = new AbortController();
    analysisRef.current = { gameStateId: stateId, position: myPosition, abortController };

    console.log('[useLocalAnalysis] Triggering analysis', {
      isMyCurrentTurn,
      isMyNextTurn,
      currentPlayerPosition: gameState.currentPlayerPosition,
      nextPlayerPosition,
      myPosition
    });

    // Run analysis asynchronously
    void runAnalysis(gameState, myPosition, abortController);
  }, [gameState, myPosition, nextPlayerPosition, runAnalysis, setAIAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisRef.current) {
        analysisRef.current.abortController.abort();
      }
    };
  }, []);

  return {
    isThinking,
    progress,
    runAnalysis
  };
}
