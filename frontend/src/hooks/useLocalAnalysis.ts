/**
 * @module hooks/useLocalAnalysis
 * @description Client-side MCTS analysis with progress tracking
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

/**
 * Hook for running client-side MCTS analysis with progress tracking
 */
export function useLocalAnalysis() {
  const { gameState, myPosition, setAIAnalysis } = useGameStore();
  const [isThinking, setIsThinking] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const analysisRef = useRef<{ gameStateId: string; position: number } | null>(null);

  const runAnalysis = useCallback(async (
    state: GameState,
    position: number,
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
    setProgress({ simulations: 0, totalSimulations: 5000, progress: 0 });

    const engine = new ISMCTSEngine({
      simulations: 5000,
      verbose: false,
    });

    try {
      // Run analysis with progress callbacks
      const results = await engine.analyzeHandWithProgress(
        state,
        position,
        (simulations: number, total: number) => {
          const progressPercent = Math.round((simulations / total) * 100);
          const progressInfo = {
            simulations,
            totalSimulations: total,
            progress: progressPercent
          };
          setProgress(progressInfo);
          onProgress?.(progressInfo);
        }
      );

      // Convert to CardAnalysis format
      const cardAnalysis: CardAnalysis[] = Object.entries(results).map(([cardId, stats]) => ({
        cardId,
        expectedScore: stats.value,
        visits: stats.visits,
        confidenceInterval: stats.confidence ? {
          lower: stats.confidence.lower,
          upper: stats.confidence.upper,
          width: stats.confidence.upper - stats.confidence.lower
        } : undefined,
        buckProbability: stats.buckProbability
      }));

      return cardAnalysis;
    } catch (error) {
      console.error('[useLocalAnalysis] Analysis failed:', error);
      return null;
    } finally {
      setIsThinking(false);
      setProgress(null);
    }
  }, []);

  // Auto-trigger analysis when it's my turn
  useEffect(() => {
    if (!gameState || myPosition === null) {
      return;
    }

    const shouldAnalyze =
      gameState.phase === 'PLAYING' &&
      gameState.currentPlayerPosition === myPosition;

    if (!shouldAnalyze) {
      // Clear analysis when not my turn
      if (analysisRef.current) {
        setAIAnalysis(null);
        analysisRef.current = null;
      }
      return;
    }

    // Create a unique ID for this game state + position combination
    const stateId = `${gameState.gameId}-${gameState.version}-${gameState.phase}-${myPosition}`;

    // Skip if we've already analyzed this exact state
    if (analysisRef.current?.gameStateId === stateId) {
      return;
    }

    analysisRef.current = { gameStateId: stateId, position: myPosition };

    // Run analysis asynchronously
    void runAnalysis(gameState, myPosition).then((analysis) => {
      if (analysis) {
        setAIAnalysis(analysis);
      }
    });
  }, [gameState, myPosition, runAnalysis, setAIAnalysis]);

  return {
    isThinking,
    progress,
    runAnalysis
  };
}
