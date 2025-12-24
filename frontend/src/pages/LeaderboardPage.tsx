import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getGlobalLeaderboard, getFriendsLeaderboard } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  winRate: number;
  bidSuccessRate: number;
  totalRounds?: number;
  foldRate?: number;
  bucks?: number;
  tricksWon?: number;
  avgPointsPerGame?: number;
  timesCouldFold?: number;
  totalBids?: number;
}

type LeaderboardType = 'global' | 'friends';
type SortBy = 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' | 'totalRounds' | 'foldRate' | 'bucks' | 'tricksWon' | 'avgPointsPerGame';

export default function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>('global');
  const [sortBy, setSortBy] = useState<SortBy>('gamesWon');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { userId, checkAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!checkAuth()) {
      navigate('/login');
      return;
    }

    loadLeaderboard();
  }, [type, sortBy, checkAuth, navigate]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError('');
      
      const data = type === 'global'
        ? await getGlobalLeaderboard(sortBy)
        : await getFriendsLeaderboard(sortBy);
      
      // Ensure data is an array (API functions should return arrays, but add safety check)
      const entriesArray = Array.isArray(data) ? data : (data.leaderboard || []);
      
      // Transform entries to flatten the user object
      const transformedEntries: LeaderboardEntry[] = entriesArray.map((entry: any) => ({
        userId: entry.userId,
        username: entry.user?.username || entry.username || '',
        displayName: entry.user?.displayName || entry.displayName || '',
        avatarUrl: entry.user?.avatarUrl || entry.avatarUrl,
        gamesPlayed: entry.gamesPlayed || 0,
        gamesWon: entry.gamesWon || 0,
        totalPoints: entry.totalPoints || 0,
        winRate: entry.winRate || 0,
        bidSuccessRate: entry.bidSuccessRate || 0,
        totalRounds: entry.totalRounds || 0,
        foldRate: entry.foldRate || 0,
        bucks: entry.bucks || 0,
        tricksWon: entry.tricksWon || 0,
        avgPointsPerGame: entry.avgPointsPerGame || 0,
        timesCouldFold: entry.timesCouldFold || 0,
        totalBids: entry.totalBids || 0,
      }));
      
      console.log('[LeaderboardPage] Leaderboard data:', data, 'Transformed:', transformedEntries);
      
      setEntries(transformedEntries);
    } catch (err) {
      console.error('[LeaderboardPage] Error loading leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-emerald-700">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-green-50">

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          {/* Type Toggle */}
          <div className="flex bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-md border border-green-200/50">
            <button
              onClick={() => setType('global')}
              className={`flex-1 py-2 px-6 rounded-md font-medium transition-colors ${
                type === 'global'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              🌍 Global
            </button>
            <button
              onClick={() => setType('friends')}
              className={`flex-1 py-2 px-6 rounded-md font-medium transition-colors ${
                type === 'friends'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              👥 Friends
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-full md:w-auto px-4 py-2 bg-white/80 backdrop-blur-sm border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-emerald-900 shadow-md"
            >
              <option value="gamesWon">🏆 Most Wins</option>
              <option value="winRate">📈 Win Rate</option>
              <option value="totalPoints">⭐ Total Points</option>
              <option value="bidSuccessRate">🎯 Bid Success</option>
              <option value="totalRounds">🔄 Total Rounds</option>
              <option value="foldRate">📉 Fold Rate</option>
              <option value="bucks">💰 Bucks</option>
              <option value="tricksWon">🃏 Tricks Won</option>
              <option value="avgPointsPerGame">📊 Avg Points/Game</option>
            </select>
          </div>
        </div>

        {/* Leaderboard */}
        {entries.length === 0 ? (
          <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <div className="text-emerald-400 mb-4">
              <span className="text-6xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-emerald-800 mb-2">
              {type === 'friends' ? 'No Friends Data' : 'No Leaderboard Data'}
            </h3>
            <p className="text-emerald-700">
              {type === 'friends'
                ? 'Add friends and play games to see friend rankings!'
                : 'Be the first to play and claim the top spot!'}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <div className="divide-y divide-emerald-100/50">
              {entries.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = entry.userId === userId;
                
                // Get the relevant metric value based on sortBy
                const getMetricValue = () => {
                  switch (sortBy) {
                    case 'gamesWon':
                      return { label: 'Wins', value: entry.gamesWon, unit: '' };
                    case 'winRate':
                      return { label: 'Win Rate', value: entry.winRate.toFixed(1), unit: '%' };
                    case 'totalPoints':
                      return { label: 'Points', value: entry.totalPoints.toLocaleString(), unit: '' };
                    case 'bidSuccessRate':
                      return { label: 'Bid Success', value: entry.bidSuccessRate.toFixed(1), unit: '%' };
                    case 'totalRounds':
                      return { label: 'Rounds', value: (entry.totalRounds || 0).toLocaleString(), unit: '' };
                    case 'foldRate':
                      return { label: 'Fold Rate', value: (entry.foldRate || 0).toFixed(1), unit: '%' };
                    case 'bucks':
                      return { label: 'Bucks', value: (entry.bucks || 0).toLocaleString(), unit: '' };
                    case 'tricksWon':
                      return { label: 'Tricks Won', value: (entry.tricksWon || 0).toLocaleString(), unit: '' };
                    case 'avgPointsPerGame':
                      return { label: 'Avg Points/Game', value: (entry.avgPointsPerGame || 0).toFixed(1), unit: '' };
                    default:
                      return { label: 'Wins', value: entry.gamesWon, unit: '' };
                  }
                };
                
                const metric = getMetricValue();
                
                // Check if player has insufficient data for the current metric
                const hasLowData = () => {
                  switch (sortBy) {
                    case 'avgPointsPerGame':
                      return entry.gamesPlayed < 5;
                    case 'foldRate':
                      return (entry.timesCouldFold || 0) < 5;
                    case 'winRate':
                      return entry.gamesPlayed < 5;
                    case 'bidSuccessRate':
                      return (entry.totalBids || 0) < 5;
                    default:
                      return false;
                  }
                };
                
                const isLowData = hasLowData();
                
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-4 py-2 transition-colors ${
                      isLowData 
                        ? 'bg-gray-100/50 opacity-75' 
                        : isCurrentUser 
                          ? 'bg-emerald-100/40 hover:bg-emerald-50/30' 
                          : 'hover:bg-emerald-50/30'
                    }`}
                  >
                    {/* Left: Rank + User */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-lg font-bold text-emerald-700 flex-shrink-0">
                        {getRankEmoji(rank)}
                      </span>
                      
                      {/* Avatar */}
                      {entry.avatarUrl ? (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.displayName || entry.username || 'User'}
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">
                            {(entry.displayName || entry.username || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${
                            isLowData ? 'text-gray-600' : 'text-emerald-900'
                          }`}>
                            {entry.displayName || entry.username || 'User'}
                          </p>
                          {isLowData && (
                            <span className="px-1.5 py-0.5 bg-gray-300 text-gray-700 text-xs font-medium rounded flex-shrink-0" title="Low data: May not be statistically significant">
                              ⚠️ Low Data
                            </span>
                          )}
                          {isCurrentUser && !isLowData && (
                            <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-800 text-xs font-medium rounded flex-shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${
                          isLowData ? 'text-gray-500' : 'text-emerald-600'
                        }`}>
                          @{entry.username}
                        </p>
                      </div>
                    </div>
                    
                    {/* Right: Metric Value */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <div className="text-right">
                        <p className={`text-xs uppercase tracking-wide ${
                          isLowData ? 'text-gray-500' : 'text-emerald-600'
                        }`}>
                          {metric.label}
                        </p>
                        <p className={`text-lg font-bold ${
                          isLowData ? 'text-gray-600' : 'text-emerald-700'
                        }`}>
                          {metric.value}{metric.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      </div>
      </div>
    </>
  );
}

