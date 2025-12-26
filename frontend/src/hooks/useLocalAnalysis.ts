/**
 * @module hooks/useLocalAnalysis
 * @description Client-side MCTS analysis with progress tracking and continuous analysis
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ISMCTSEngine } from '@/ai/ismcts';
import type { GameState, CardAnalysis, BidAnalysis, FoldAnalysis, SuitAnalysis, BidAmount, Suit } from '@buck-euchre/shared';

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
  const { gameState, myPosition, setAIAnalysis, setBidAnalysis, setFoldAnalysis, setSuitAnalysis } = useGameStore();
  const [isThinking, setIsThinking] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const analysisRef = useRef<{ gameStateId: string; position: number; abortController: AbortController } | null>(null);

  const runAnalysis = useCallback(async (
    state: GameState,
    position: number,
    abortController: AbortController,
    onProgress?: (progress: AnalysisProgress) => void
  ) => {
    // Check if it's the player's turn for the current phase
    let shouldAnalyze = false;
    if (state.phase === 'PLAYING' && state.currentPlayerPosition === position) {
      shouldAnalyze = true;
    } else if (state.phase === 'BIDDING' && state.currentBidder === position) {
      shouldAnalyze = true;
    } else if (state.phase === 'DECLARING_TRUMP' && state.winningBidderPosition === position) {
      shouldAnalyze = true;
    } else if (state.phase === 'FOLDING_DECISION') {
      const player = state.players[position];
      if (position !== state.winningBidderPosition && player.foldDecision === 'UNDECIDED') {
        shouldAnalyze = true;
      }
    }

    if (!shouldAnalyze) {
      return null;
    }

    setIsThinking(true);

    try {
      // Create engine with 20k iterations
      const maxIterations = ANALYSIS_STAGES[ANALYSIS_STAGES.length - 1]; // 20000
      const engine = new ISMCTSEngine({
        simulations: maxIterations,
        verbose: false,
      });

      // For non-PLAYING phases, use searchWithAnalysis (synchronous)
      if (state.phase !== 'PLAYING') {
        const result = engine.searchWithAnalysis(state, position as any);
        
        // Convert statistics to appropriate analysis format based on phase
        const statistics = result.statistics;
        
        if (state.phase === 'BIDDING') {
          // Convert to BidAnalysis
          const bidStats = new Map<BidAmount, any>();
          for (const [key, stat] of statistics) {
            if (stat.action.type === 'BID') {
              bidStats.set(stat.action.amount, stat);
            }
          }
          
          const entries = Array.from(bidStats.entries());
          const sorted = [...entries].sort(([, a], [, b]) => b.avgValue - a.avgValue);
          const ranks = new Map(sorted.map(([bid], index) => [bid, index + 1]));
          
          const bidAnalysis: BidAnalysis[] = entries.map(([bidAmount, stat]) => ({
            bidAmount,
            winProbability: stat.avgValue,
            expectedScore: stat.avgValue,
            confidence: Math.min(1, stat.visits / 1000),
            visits: stat.visits,
            rank: ranks.get(bidAmount) || 0,
            buckProbability: stat.buckProbability || 0,
          }));
          
          if (!abortController.signal.aborted) {
            setBidAnalysis(bidAnalysis);
          }
        } else if (state.phase === 'FOLDING_DECISION') {
          // Convert to FoldAnalysis
          const foldStats = new Map<boolean, any>();
          for (const [key, stat] of statistics) {
            if (stat.action.type === 'FOLD') {
              foldStats.set(stat.action.fold, stat);
            }
          }
          
          const entries = Array.from(foldStats.entries());
          const sorted = [...entries].sort(([, a], [, b]) => b.avgValue - a.avgValue);
          const bestFold = sorted[0]?.[0] ?? false;
          
          const foldAnalysis: FoldAnalysis[] = entries.map(([fold, stat]) => ({
            fold,
            winProbability: stat.avgValue,
            expectedScore: stat.avgValue,
            confidence: Math.min(1, stat.visits / 1000),
            visits: stat.visits,
            isBest: fold === bestFold,
            buckProbability: stat.buckProbability || 0,
          }));
          
          if (!abortController.signal.aborted) {
            setFoldAnalysis(foldAnalysis);
          }
        } else if (state.phase === 'DECLARING_TRUMP') {
          // Convert to SuitAnalysis
          const suitStats = new Map<Suit, any>();
          for (const [key, stat] of statistics) {
            if (stat.action.type === 'TRUMP') {
              suitStats.set(stat.action.suit, stat);
            }
          }
          
          const entries = Array.from(suitStats.entries());
          const sorted = [...entries].sort(([, a], [, b]) => b.avgValue - a.avgValue);
          const ranks = new Map(sorted.map(([suit], index) => [suit, index + 1]));
          
          const suitAnalysis: SuitAnalysis[] = entries.map(([suit, stat]) => ({
            suit,
            winProbability: stat.avgValue,
            expectedScore: stat.avgValue,
            confidence: Math.min(1, stat.visits / 1000),
            visits: stat.visits,
            rank: ranks.get(suit) || 0,
            buckProbability: stat.buckProbability || 0,
          }));
          
          if (!abortController.signal.aborted) {
            setSuitAnalysis(suitAnalysis);
          }
        }
      } else {
        // For PLAYING phase, use searchWithAnalysis (same as other phases for consistency)
        const player = state.players[position];
        if (player && player.hand && player.hand.length > 0) {
          const result = await engine.searchWithAnalysis(state, position as any);
          const statistics = result.statistics;
          
          // Convert to CardAnalysis format (same as backend analysis.service.ts)
          const cardStats = new Map<string, any>();
          for (const [key, stat] of statistics) {
            if (stat.action.type === 'CARD') {
              cardStats.set(stat.action.card.id, stat);
            }
          }
          
          const analyses: CardAnalysis[] = [];
          for (const card of player.hand) {
            const stats = cardStats.get(card.id);
            
            if (!stats) {
              analyses.push({
                cardId: card.id,
                winProbability: 0,
                expectedTricks: 0,
                expectedScore: 5, // Worst case
                confidence: 0,
                visits: 0,
                rank: player.hand.length,
              });
              continue;
            }
            
            // Calculate metrics from MCTS values (same as backend)
            // avgValue is normalized score change where:
            //   1.0 = best outcome (-5 score: took all 5 tricks)
            //   0.5 = neutral outcome (0 score change)
            //   0.0 = worst outcome (+5 score: got set/failed)
            const winProbability = stats.avgValue;
            const confidence = Math.min(stats.visits / 200, 1);
            const expectedScoreChange = -(winProbability * 10 - 5); // Reverse the normalization
            const remainingTricks = 5 - (state.tricks?.length || 0);
            const expectedTricks = Math.max(0, Math.min(remainingTricks, -expectedScoreChange));
            
            // Convert confidence interval from avgValue scale to expectedScore scale
            const ciLowerScore = -(stats.confidenceInterval.lower * 10 - 5);
            const ciUpperScore = -(stats.confidenceInterval.upper * 10 - 5);
            const ciWidth = Math.abs(ciLowerScore - ciUpperScore);
            const stdErrorScore = stats.stdError * 10;
            
            analyses.push({
              cardId: card.id,
              winProbability,
              expectedTricks,
              expectedScore: expectedScoreChange,
              confidence,
              visits: stats.visits,
              rank: 0, // Will be set after sorting
              buckProbability: stats.buckProbability,
              standardError: stdErrorScore,
              confidenceInterval: {
                lower: Math.min(ciLowerScore, ciUpperScore),
                upper: Math.max(ciLowerScore, ciUpperScore),
                width: ciWidth,
              },
            });
          }
          
          // Sort by win probability (descending) and assign ranks
          analyses.sort((a, b) => b.winProbability - a.winProbability);
          analyses.forEach((analysis, index) => {
            analysis.rank = index + 1;
          });
          
          if (!abortController.signal.aborted) {
            setAIAnalysis(analyses);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[useLocalAnalysis] Analysis failed:', error);
      return null;
    } finally {
      setIsThinking(false);
      setProgress(null);
    }
  }, [setAIAnalysis, setBidAnalysis, setFoldAnalysis, setSuitAnalysis]);

  // Auto-trigger analysis when it's my turn
  useEffect(() => {
    if (!gameState || myPosition === null) {
      return;
    }

    // Check if it's my turn for the current phase
    let shouldAnalyze = false;
    if (gameState.phase === 'PLAYING' && gameState.currentPlayerPosition === myPosition) {
      shouldAnalyze = true;
    } else if (gameState.phase === 'BIDDING' && gameState.currentBidder === myPosition) {
      shouldAnalyze = true;
    } else if (gameState.phase === 'DECLARING_TRUMP' && gameState.winningBidderPosition === myPosition) {
      shouldAnalyze = true;
    } else if (gameState.phase === 'FOLDING_DECISION') {
      const myPlayer = gameState.players[myPosition];
      if (myPosition !== gameState.winningBidderPosition && myPlayer.foldDecision === 'UNDECIDED') {
        shouldAnalyze = true;
      }
    }

    if (!shouldAnalyze) {
      // Clear all analysis when not my turn and abort ongoing analysis
      if (analysisRef.current) {
        analysisRef.current.abortController.abort();
        setAIAnalysis(null);
        setBidAnalysis(null);
        setFoldAnalysis(null);
        setSuitAnalysis(null);
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

    // Abort previous analysis if running
    if (analysisRef.current) {
      analysisRef.current.abortController.abort();
    }

    // Create new abort controller for this analysis
    const abortController = new AbortController();
    analysisRef.current = { gameStateId: stateId, position: myPosition, abortController };

    console.log(`[useLocalAnalysis] Starting 20k iteration analysis for phase ${gameState.phase}`);

    // Run analysis asynchronously
    void runAnalysis(gameState, myPosition, abortController);
  }, [gameState, myPosition, runAnalysis, setAIAnalysis, setBidAnalysis, setFoldAnalysis, setSuitAnalysis]);

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
