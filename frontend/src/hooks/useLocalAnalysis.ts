/**
 * @module hooks/useLocalAnalysis
 * @description Client-side MCTS analysis with progress tracking and continuous analysis
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
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
      // Use fewer simulations for non-PLAYING phases to prevent UI freezing
      // BIDDING, FOLDING_DECISION, and DECLARING_TRUMP have fewer options so need less analysis
      const simulationCount = state.phase === 'PLAYING' ? 20000 : 5000;

      // Create engine with appropriate iteration count
      const engine = new ISMCTSEngine({
        simulations: simulationCount,
        verbose: false,
      });

      // For non-PLAYING phases, use searchWithAnalysis (async)
      if (state.phase !== 'PLAYING') {
        const result = await engine.searchWithAnalysis(state, position as any);
        
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
            expectedScore: -(stat.avgValue * 10 - 5), // Apply transformation: normalized [0,1] -> score [-5,+5]
            confidence: Math.min(1, stat.visits / 200), // Match backend confidence calculation
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
            expectedScore: -(stat.avgValue * 10 - 5), // Apply transformation: normalized [0,1] -> score [-5,+5]
            confidence: Math.min(1, stat.visits / 200), // Match backend confidence calculation
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
            expectedScore: -(stat.avgValue * 10 - 5), // Apply transformation: normalized [0,1] -> score [-5,+5]
            confidence: Math.min(1, stat.visits / 200), // Match backend confidence calculation
            visits: stat.visits,
            rank: ranks.get(suit) || 0,
            buckProbability: stat.buckProbability || 0,
          }));
          
          if (!abortController.signal.aborted) {
            setSuitAnalysis(suitAnalysis);
          }
        }
      } else {
        // For PLAYING phase, use analyzeHandWithProgress for progress updates
        const player = state.players[position];
        if (player && player.hand && player.hand.length > 0) {
          const playerHand = player.hand; // Capture for use in closure
          
          // Helper to convert results to CardAnalysis format (same as backend)
          const convertToCardAnalysis = (results: Record<string, any>): CardAnalysis[] => {
            const entries = Object.entries(results);
            const analyses: CardAnalysis[] = [];
            
            for (const card of playerHand) {
              const stats = results[card.id];
              
              if (!stats) {
                analyses.push({
                  cardId: card.id,
                  winProbability: 0,
                  expectedTricks: 0,
                  expectedScore: 5, // Worst case
                  confidence: 0,
                  visits: 0,
                  rank: playerHand.length,
                });
                continue;
              }
              
              // Calculate metrics from MCTS values (same as backend)
              // stats.value is normalized [0, 1] where:
              //   1.0 = best outcome (-5 score: took all 5 tricks)
              //   0.5 = neutral outcome (0 score change)
              //   0.0 = worst outcome (+5 score: got set/failed)
              const normalizedValue = stats.value;
              const winProbability = normalizedValue;
              const confidence = Math.min(stats.visits / 200, 1);
              const expectedScoreChange = -(normalizedValue * 10 - 5); // Reverse the normalization
              const remainingTricks = 5 - (state.tricks?.length || 0);
              const expectedTricks = Math.max(0, Math.min(remainingTricks, -expectedScoreChange));
              
              // Convert confidence interval from normalized [0,1] to score [-5,+5]
              let confidenceInterval;
              if (stats.confidence) {
                const ciLowerScore = -(stats.confidence.upper * 10 - 5);
                const ciUpperScore = -(stats.confidence.lower * 10 - 5);
                const ciWidth = Math.abs(ciLowerScore - ciUpperScore);
                confidenceInterval = {
                  lower: Math.min(ciLowerScore, ciUpperScore),
                  upper: Math.max(ciLowerScore, ciUpperScore),
                  width: ciWidth,
                };
              }
              
              analyses.push({
                cardId: card.id,
                winProbability,
                expectedTricks,
                expectedScore: expectedScoreChange,
                confidence,
                visits: stats.visits,
                rank: 0, // Will be set after sorting
                buckProbability: stats.buckProbability || 0,
                confidenceInterval,
              });
            }
            
            // Sort by win probability (descending) and assign ranks
            analyses.sort((a, b) => b.winProbability - a.winProbability);
            analyses.forEach((analysis, index) => {
              analysis.rank = index + 1;
            });
            
            return analyses;
          };

          const results = await engine.analyzeHandWithProgress(
            state,
            position as any,
            (simulations: number, total: number) => {
              if (abortController.signal.aborted) return;
              const progressPercent = Math.round((simulations / total) * 100);
              const progressInfo = { simulations, totalSimulations: total, progress: progressPercent };
              setProgress(progressInfo);
              onProgress?.(progressInfo);
            },
            (intermediateResults) => {
              // Update UI with intermediate results every 1000 simulations
              if (!abortController.signal.aborted) {
                const cardAnalysis = convertToCardAnalysis(intermediateResults);
                setAIAnalysis(cardAnalysis);
              }
            },
            abortController.signal
          );

          // Set final results
          if (!abortController.signal.aborted) {
            const cardAnalysis = convertToCardAnalysis(results);
            setAIAnalysis(cardAnalysis);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[useLocalAnalysis] Analysis failed:', error);
      // Make sure to clear thinking state even on error
      setIsThinking(false);
      setProgress(null);
      return null;
    } finally {
      setIsThinking(false);
      setProgress(null);
    }
  }, [setAIAnalysis, setBidAnalysis, setFoldAnalysis, setSuitAnalysis]);

  // Auto-trigger analysis when it's my turn
  useEffect(() => {
    const showCardOverlay = useSettingsStore.getState().showCardOverlay;

    // Skip analysis if user has disabled card overlay
    if (!showCardOverlay) {
      // Clear all analysis and abort ongoing analysis
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

    console.log(`[useLocalAnalysis] Starting analysis for phase ${gameState.phase}`);

    // Delay analysis start slightly to allow UI to update first
    // This prevents blocking the render when state changes rapidly
    const timeoutId = setTimeout(() => {
      // Run analysis asynchronously with error handling
      runAnalysis(gameState, myPosition, abortController).catch((error) => {
        console.error('[useLocalAnalysis] Unhandled analysis error:', error);
        // Clear the ref on error to allow retry
        if (analysisRef.current?.gameStateId === stateId) {
          analysisRef.current = null;
        }
      });
    }, 50); // 50ms delay to let UI render

    // Cleanup timeout if effect re-runs
    return () => clearTimeout(timeoutId);
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
