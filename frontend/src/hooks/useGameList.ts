/**
 * @module hooks/useGameList
 * @description Custom hook for managing game list state
 */

import { useState, useEffect, useCallback } from 'react';
import { listGames } from '@/services/api';
import type { GameSummary } from '@buck-euchre/shared';
import { useUIStore } from '@/stores/uiStore';

export function useGameList() {
  const { setError } = useUIStore();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchGames = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true);
      }
      const response = await listGames();
      setGames(response.games);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load games';
      setError(message);
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
    }
  }, [setError]);

  useEffect(() => {
    fetchGames(true);
    
    // Auto-refresh game list every 5 seconds
    const interval = setInterval(() => fetchGames(false), 5000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  return {
    games,
    initialLoading,
    fetchGames,
  };
}

