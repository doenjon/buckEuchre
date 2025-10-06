/**
 * @module components/game/WaitingForPlayers
 * @description Component shown while waiting for players to join
 */

import { Users, Copy, CheckCircle2, Bot, Loader2, Hourglass } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { addAIToGame } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';

interface WaitingForPlayersProps {
  gameId: string;
  playerCount: number;
  playersNeeded: number;
  onAIAdded?: (result: AddAIToGameResult) => void;
  message?: string;
}

type AddAIToGameResult = Awaited<ReturnType<typeof addAIToGame>>;

export function WaitingForPlayers({
  gameId,
  playerCount,
  playersNeeded,
  onAIAdded,
  message,
}: WaitingForPlayersProps) {
  const [copied, setCopied] = useState(false);
  const [addingAI, setAddingAI] = useState(false);
  const { setError } = useUIStore();
  const waitingInfo = useGameStore(state => state.waitingInfo);
  const setWaitingInfo = useGameStore(state => state.setWaitingInfo);
  const setGameState = useGameStore(state => state.setGameState);

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
      <Card className="w-full max-w-3xl overflow-hidden border-emerald-500/20 bg-white/95 shadow-2xl backdrop-blur">
        <div className="bg-green-950/90 text-white px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-600/80 p-3">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">Game Lobby</p>
              <h2 className="text-2xl font-semibold">Waiting for Players</h2>
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold shadow-sm backdrop-blur ${
              playerCount === 4
                ? 'border-emerald-300 bg-emerald-500/40'
                : 'border-white/30 bg-white/10'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{playerCount}/4 ready</span>
          </div>
        </div>

        <div className="p-6 md:p-8 bg-white/90">
          <div className="grid gap-8 md:grid-cols-[3fr,2fr]">
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Hourglass className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Setting the table</span>
                </div>
                <p className="text-xl font-semibold text-gray-900">{waitingMessage}</p>
                <p className="text-sm text-gray-600">
                  Sit tight while we gather everyone. As soon as the table is full the game will begin automatically.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <span>Players joined</span>
                  <span>{playerCount}/4</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((seat) => (
                    <div
                      key={seat}
                      className={`h-3 rounded-full transition-colors ${
                        seat <= playerCount
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  {playerCount === 0
                    ? 'Waiting for the first player to join.'
                    : `${playerCount} player${playerCount === 1 ? ' has' : 's have'} taken a seat.`}
                </p>
              </div>

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

              <div className="flex items-center gap-3 text-emerald-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Getting everything ready&hellip;</span>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-inner">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Bot className="h-5 w-5" />
                  <p className="font-semibold">Need a full table?</p>
                </div>
                <p className="text-sm text-emerald-700">
                  {playersNeeded > 0
                    ? `Add AI teammates to fill the remaining ${playersNeeded} seat${playersNeeded === 1 ? '' : 's'} and jump right into the action.`
                    : 'Everyone is here! We are arranging the deck and will start any second now.'}
                </p>
              </div>

              {playersNeeded > 0 ? (
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
              ) : (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All players are ready!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
