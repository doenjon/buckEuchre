/**
 * @module components/lobby/AddAIButton
 * @description Button to add AI players to a game with difficulty selection
 */

import { useState } from 'react';
import { Bot, Loader2, X } from 'lucide-react';
import { addAIToGame, type AIDifficulty } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface AddAIButtonProps {
  gameId: string;
  onAIAdded?: () => void;
}

const DIFFICULTY_DESCRIPTIONS: Record<AIDifficulty, { label: string; description: string; thinkTime: string }> = {
  easy: { label: 'Easy', description: 'Quick decisions, competent play', thinkTime: '~100ms' },
  medium: { label: 'Medium', description: 'Solid strategic thinking', thinkTime: '~300ms' },
  hard: { label: 'Hard', description: 'Strong tactical analysis', thinkTime: '~1.5s' },
  expert: { label: 'Expert', description: 'Deep analysis, near-optimal play', thinkTime: '~15s' },
  master: { label: 'Master', description: 'Extremely deep championship-level', thinkTime: '~30s' },
  grandmaster: { label: 'Grandmaster', description: 'Exhaustive theoretically-optimal', thinkTime: '~75s' },
};

export function AddAIButton({ gameId, onAIAdded }: AddAIButtonProps) {
  const [adding, setAdding] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('hard');
  const { setError } = useUIStore();

  const handleAddAI = async () => {
    try {
      setAdding(true);
      await addAIToGame(gameId, { difficulty });

      setShowDialog(false);

      // Notify parent component to refresh
      if (onAIAdded) {
        onAIAdded();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add AI player';
      setError(message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        size="sm"
        className="gap-2"
        aria-label="Add AI player"
      >
        <Bot className="h-4 w-4" />
        Add AI
      </Button>

      {/* Add AI Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !adding && setShowDialog(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-white/20 rounded-lg shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Add AI Player
              </h2>
              <button
                onClick={() => setShowDialog(false)}
                disabled={adding}
                className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <Label htmlFor="ai-difficulty" className="text-base text-white">
                  AI Difficulty
                </Label>
                <Select
                  value={difficulty}
                  onValueChange={(value) => setDifficulty(value as AIDifficulty)}
                >
                  <SelectTrigger id="ai-difficulty" className="w-full bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {Object.entries(DIFFICULTY_DESCRIPTIONS).map(([key, { label, description, thinkTime }]) => (
                      <SelectItem key={key} value={key} className="text-white hover:bg-gray-700">
                        <div className="flex flex-col">
                          <div className="font-semibold">{label}</div>
                          <div className="text-xs text-gray-400">
                            {description} • {thinkTime}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Selected difficulty info */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                  <p className="text-sm text-blue-200">
                    <span className="font-semibold">{DIFFICULTY_DESCRIPTIONS[difficulty].label}:</span>{' '}
                    {DIFFICULTY_DESCRIPTIONS[difficulty].description}
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    Think time: {DIFFICULTY_DESCRIPTIONS[difficulty].thinkTime} per decision
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10">
              <div className="flex gap-4">
                <Button
                  onClick={() => setShowDialog(false)}
                  disabled={adding}
                  variant="outline"
                  className="flex-1 border-white/30 text-white hover:bg-white/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddAI}
                  disabled={adding}
                  variant="primary"
                  className="flex-1 gap-2"
                >
                  {adding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4" />
                      Add AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
