/**
 * @module components/game/WaitingForPlayers
 * @description Component shown while waiting for players to join
 */

import { Users, Copy, CheckCircle2, Bot, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { addAIToGame, getGameState } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';

interface WaitingForPlayersProps {
  gameId: string;
  playerCount: number;
  playersNeeded: number;
  onAIAdded?: (result: AddAIToGameResult) => void;
  message?: string;
  players?: Array<{ id: string; name: string; position: number }>;
}

type AddAIToGameResult = Awaited<ReturnType<typeof addAIToGame>>;

export function WaitingForPlayers({
  gameId,
  playerCount,
  playersNeeded,
  onAIAdded,
  message,
  players = [],
}: WaitingForPlayersProps) {
  const [copied, setCopied] = useState(false);
  const [addingAI, setAddingAI] = useState(false);
  const [gamePlayers, setGamePlayers] = useState<Array<{ id: string; name: string; position: number }>>(players || []);
  const [loadingPlayers, setLoadingPlayers] = useState(!players || players.length === 0);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const { setError } = useUIStore();
  const waitingInfo = useGameStore(state => state.waitingInfo);
  const setWaitingInfo = useGameStore(state => state.setWaitingInfo);
  const setGameState = useGameStore(state => state.setGameState);

  // Fetch game info to get players from database
  useEffect(() => {
    const fetchGamePlayers = async (isInitialLoad: boolean = false) => {
      try {
        // Only show loading on initial fetch
        if (isInitialLoad) {
          setLoadingPlayers(true);
        }
        
        // Query the game API to get player information from database
        const gameData: any = await getGameState(gameId);
        
        // The API returns either GameState (if game started) or Game (if waiting)
        // Both have a players array, but with different structures
        if (!gameData || !gameData.players || !Array.isArray(gameData.players)) {
          console.warn('[WaitingForPlayers] No players found in game data');
          if (isInitialLoad) {
            setLoadingPlayers(false);
            setHasInitiallyLoaded(true);
          }
          return;
        }
        
        // Map players to our format
        const mappedPlayers = gameData.players
          .filter((p: any) => p && (p.id || p.user || p.guestName))
          .map((p: any) => {
            // Handle GameState format (Player objects with name field)
            if (p.name && p.id) {
              return {
                id: p.id,
                name: p.name,
                position: p.position ?? -1,
              };
            }
            
            // Handle Game format (GamePlayer objects with user relation)
            if (p.user || p.guestName) {
              const isAI = p.user?.username?.startsWith('AI_');
              const name = isAI 
                ? (p.user?.displayName || 'Bot')
                : (p.user?.displayName || p.user?.username || p.guestName || 'Unknown');
              
              return {
                id: p.user?.id || p.userId || '',
                name,
                position: p.position ?? -1,
              };
            }
            
            return null;
          })
          .filter((p: any) => p !== null);
        
        if (mappedPlayers.length > 0) {
          setGamePlayers(mappedPlayers);
        }
        
        if (isInitialLoad) {
          setLoadingPlayers(false);
          setHasInitiallyLoaded(true);
        }
      } catch (err) {
        console.error('[WaitingForPlayers] Error fetching game players:', err);
        if (isInitialLoad) {
          setLoadingPlayers(false);
          setHasInitiallyLoaded(true);
        }
      }
    };

    // If we already have players from props, don't show loading
    if (players && players.length > 0) {
      setLoadingPlayers(false);
      setHasInitiallyLoaded(true);
    } else {
      // Initial fetch with loading state
      fetchGamePlayers(true);
    }
    
    // Refresh players periodically (without loading state)
    // Increased interval to reduce database load
    const interval = setInterval(() => fetchGamePlayers(false), 5000);
    return () => clearInterval(interval);
  }, [gameId, players]);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/game/${gameId}`
    : `/game/${gameId}`;

  const handleCopyGameUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddAI = async () => {
    try {
      setAddingAI(true);
      const result = await addAIToGame(gameId, { difficulty: 'medium' });

      if (result.gameState) {
        setGameState(result.gameState);
      } else {
        const nextCount = result.playerCount ?? Math.min(4, (waitingInfo?.playerCount ?? playerCount) + 1);
        const nextNeeded = result.playersNeeded ?? Math.max(0, 4 - nextCount);
        const nextMessage = result.waitingMessage
          ? result.waitingMessage
          : nextNeeded > 0
            ? `Waiting for ${nextNeeded} more player${nextNeeded === 1 ? '' : 's'}...`
            : 'All seats filled. Starting shortly...';

        setWaitingInfo({
          gameId,
          playerCount: nextCount,
          playersNeeded: nextNeeded,
          message: nextMessage,
        });
      }

      if (onAIAdded) {
        onAIAdded(result);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to add AI player';
      setError(message);
    } finally {
      setAddingAI(false);
    }
  };

  const waitingMessage = message
    ? message
    : playersNeeded === 0
      ? 'All players are seated. Shuffling the deck...'
      : `Waiting for ${playersNeeded} more player${playersNeeded === 1 ? '' : 's'}...`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl overflow-hidden border-emerald-500/20 bg-white/95 shadow-2xl backdrop-blur min-h-[70vh] sm:min-h-[auto] flex flex-col">
        <div className="bg-green-950/90 text-white px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-600/80 p-3">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">Game Lobby</p>
              <h2 className="text-2xl font-semibold">Waiting for Players</h2>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 bg-white/90 flex-1 flex flex-col">
          <div className="mb-6">
            <p className="text-xl sm:text-2xl font-semibold text-gray-900">{waitingMessage}</p>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md space-y-6">
              <div className="text-center">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
                  <span>Players joined</span>
                  <span>{playerCount}/4</span>
                </div>
                
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((position) => {
                    const player = gamePlayers.find(p => p.position === position);
                    const isEmpty = !player;
                    const isLoading = loadingPlayers && !hasInitiallyLoaded && !player;
                    
                    return (
                      <div
                        key={position}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                          isEmpty && !isLoading
                            ? 'border-gray-200 bg-gray-50'
                            : 'border-emerald-200 bg-emerald-50/50'
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isEmpty && !isLoading
                            ? 'bg-gray-200'
                            : 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                        }`}>
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                          ) : isEmpty ? (
                            <Users className="h-5 w-5 text-gray-400" />
                          ) : (
                            <span className="text-sm font-bold text-white">
                              {player.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          {isLoading ? (
                            <span className="text-sm text-gray-500">Loading...</span>
                          ) : isEmpty ? (
                            <span className="text-sm text-gray-400">Empty seat</span>
                          ) : (
                            <span className="text-sm font-medium text-gray-900">{player.name}</span>
                          )}
                        </div>
                        {!isEmpty && !isLoading && (
                          <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {playersNeeded > 0 && (
                <div className="pt-2">
                  <Button
                    onClick={handleAddAI}
                    disabled={addingAI}
                    variant="primary"
                    className="w-full"
                  >
                    {addingAI ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding AI...
                      </>
                    ) : (
                      <>
                        <Bot className="mr-2 h-4 w-4" />
                        Add AI players
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-gray-200">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Share the table</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-700 shadow-inner overflow-hidden text-ellipsis">
                  {shareUrl}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyGameUrl}
                  className={`shrink-0 border-emerald-200 text-emerald-700 transition-colors hover:bg-emerald-50 ${
                    copied ? 'bg-emerald-50' : ''
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
