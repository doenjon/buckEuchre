/**
 * @module pages/ArenaPage
 * @description AI Arena page for running automated AI vs AI battles
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Swords, TrendingUp, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface ArenaConfig {
  id: string;
  name: string;
  provider: string;
  difficulty: string;
  eloRating: number;
  gamesPlayed: number;
}

interface ArenaStats {
  configId: string;
  name: string;
  eloRating: number;
  gamesPlayed: number;
  avgScore: number;
  winRate: number;
}

interface Match {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string;
  participants: Array<{
    configId: string;
    position: number;
    finalScore: number;
    eloChange: number;
    config: {
      name: string;
    };
  }>;
}

export function ArenaPage() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<ArenaConfig[]>([]);
  const [stats, setStats] = useState<ArenaStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedConfigs, setSelectedConfigs] = useState<string[]>([]);
  const [numGames, setNumGames] = useState(1);
  const [mode, setMode] = useState<'manual' | 'elo'>('elo');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [configsRes, statsRes, matchesRes] = await Promise.all([
        api.get('/arena/configs'),
        api.get('/arena/stats'),
        api.get('/arena/matches?limit=10'),
      ]);

      setConfigs(configsRes.data);
      setStats(statsRes.data);
      setMatches(matchesRes.data);
    } catch (err: any) {
      console.error('Failed to load arena data:', err);
      setError(err.message);
    }
  };

  const handleConfigToggle = (configId: string) => {
    if (selectedConfigs.includes(configId)) {
      setSelectedConfigs(selectedConfigs.filter((id) => id !== configId));
    } else if (selectedConfigs.length < 4) {
      setSelectedConfigs([...selectedConfigs, configId]);
    }
  };

  const handleRunMatches = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await api.post('/arena/run', {
        mode,
        numGames,
        configIds: mode === 'manual' ? selectedConfigs : undefined,
      });

      console.log('Matches completed:', response.data);

      // Reload data
      await loadData();

      // Reset selection
      setSelectedConfigs([]);
    } catch (err: any) {
      console.error('Failed to run matches:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%)]" />
        <div className="absolute -left-1/4 top-1/3 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/lobby')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lobby
            </Button>
            <div>
              <h1 className="text-3xl font-semibold text-white">AI Arena</h1>
              <p className="text-sm text-emerald-100/70">
                Automated AI vs AI battles with ELO rankings
              </p>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column - Configs and Match Launcher */}
          <div className="lg:col-span-2 space-y-6">
            {/* Match Launcher */}
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Launch Matches</h2>
              </div>

              <div className="space-y-4">
                {/* Mode selection */}
                <div className="flex gap-2">
                  <Button
                    variant={mode === 'elo' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setMode('elo')}
                  >
                    ELO Matchmaking
                  </Button>
                  <Button
                    variant={mode === 'manual' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setMode('manual')}
                  >
                    Manual Selection
                  </Button>
                </div>

                {/* Number of games */}
                <div>
                  <label className="block text-sm text-emerald-100/70 mb-2">
                    Number of games
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={numGames}
                    onChange={(e) => setNumGames(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-slate-800"
                  />
                </div>

                {/* Manual selection */}
                {mode === 'manual' && (
                  <div>
                    <p className="text-sm text-emerald-100/70 mb-2">
                      Select 4 configs ({selectedConfigs.length}/4)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {configs.map((config) => (
                        <button
                          key={config.id}
                          onClick={() => handleConfigToggle(config.id)}
                          className={`rounded-lg border p-3 text-left text-sm transition ${
                            selectedConfigs.includes(config.id)
                              ? 'border-emerald-500 bg-emerald-500/20'
                              : 'border-white/20 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-medium text-slate-800">{config.name}</div>
                          <div className="text-xs text-slate-600">
                            ELO: {Math.round(config.eloRating)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Run button */}
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRunMatches}
                  disabled={isRunning || (mode === 'manual' && selectedConfigs.length !== 4)}
                  className="w-full"
                >
                  {isRunning ? 'Running...' : `Run ${numGames} ${numGames === 1 ? 'Match' : 'Matches'}`}
                </Button>
              </div>
            </div>

            {/* Recent Matches */}
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Recent Matches</h2>
              </div>

              <div className="space-y-3">
                {matches.length === 0 ? (
                  <p className="text-sm text-emerald-100/50">No matches yet. Run some!</p>
                ) : (
                  matches.map((match) => {
                    const sorted = [...match.participants].sort((a, b) => b.finalScore - a.finalScore);
                    const winner = sorted[0];

                    return (
                      <div
                        key={match.id}
                        className="rounded-lg border border-white/10 bg-white/5 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium text-emerald-300">
                            Winner: {winner.config.name}
                          </span>
                          <span className="text-xs text-emerald-100/50">
                            {new Date(match.completedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {sorted.map((p) => (
                            <div key={p.position} className="text-center">
                              <div className="text-emerald-100/70">{p.config.name}</div>
                              <div className="font-medium text-white">{p.finalScore}</div>
                              <div
                                className={`text-xs ${
                                  p.eloChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {p.eloChange >= 0 ? '+' : ''}
                                {p.eloChange.toFixed(1)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right column - Leaderboard */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">ELO Rankings</h2>
            </div>

            <div className="space-y-2">
              {stats.map((stat, index) => (
                <div
                  key={stat.configId}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-medium text-emerald-300">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{stat.name}</div>
                      <div className="text-xs text-emerald-100/50">
                        {stat.gamesPlayed} games
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-emerald-300">
                      {Math.round(stat.eloRating)}
                    </div>
                    {stat.gamesPlayed > 0 && (
                      <div className="text-xs text-emerald-100/70">
                        {stat.winRate.toFixed(0)}% wins
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
