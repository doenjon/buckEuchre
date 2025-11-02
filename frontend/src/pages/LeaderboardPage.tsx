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
}

type LeaderboardType = 'global' | 'friends';
type SortBy = 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate';

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
      
      console.log('[LeaderboardPage] Leaderboard data:', data, 'Extracted:', entriesArray);
      
      setEntries(entriesArray);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leaderboard...</p>
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
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          {/* Type Toggle */}
          <div className="flex bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setType('global')}
              className={`flex-1 py-2 px-6 rounded-md font-medium transition-colors ${
                type === 'global'
                  ? 'bg-green-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🌍 Global
            </button>
            <button
              onClick={() => setType('friends')}
              className={`flex-1 py-2 px-6 rounded-md font-medium transition-colors ${
                type === 'friends'
                  ? 'bg-green-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
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
              className="w-full md:w-auto px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
            >
              <option value="gamesWon">🏆 Most Wins</option>
              <option value="winRate">📈 Win Rate</option>
              <option value="totalPoints">⭐ Total Points</option>
              <option value="bidSuccessRate">🎯 Bid Success</option>
            </select>
          </div>
        </div>

        {/* Leaderboard */}
        {entries.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <span className="text-6xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {type === 'friends' ? 'No Friends Data' : 'No Leaderboard Data'}
            </h3>
            <p className="text-gray-600">
              {type === 'friends'
                ? 'Add friends and play games to see friend rankings!'
                : 'Be the first to play and claim the top spot!'}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Games
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wins
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Win Rate
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bid Success
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {entries.map((entry, index) => {
                    const rank = index + 1;
                    const isCurrentUser = entry.userId === userId;
                    
                    return (
                      <tr
                        key={entry.userId}
                        className={`hover:bg-gray-50 transition-colors ${
                          isCurrentUser ? 'bg-green-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-2xl font-bold">
                            {getRankEmoji(rank)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            {/* Avatar */}
                            {entry.avatarUrl ? (
                              <img
                                src={entry.avatarUrl}
                                alt={entry.displayName || entry.username || 'User'}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                                <span className="text-sm font-bold text-white">
                                  {(entry.displayName || entry.username || 'U').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="font-semibold text-gray-900">
                                  {entry.displayName || entry.username || 'User'}
                                </p>
                                {isCurrentUser && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">@{entry.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {entry.gamesPlayed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-green-600">
                            {entry.gamesWon}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-blue-600">
                            {entry.winRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-orange-600">
                            {entry.totalPoints.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-purple-600">
                            {entry.bidSuccessRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {entries.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = entry.userId === userId;
                
                return (
                  <div
                    key={entry.userId}
                    className={`p-4 ${isCurrentUser ? 'bg-green-50' : ''}`}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-2xl font-bold w-10">
                        {getRankEmoji(rank)}
                      </span>
                      
                      {/* Avatar */}
                      {entry.avatarUrl ? (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.displayName || entry.username || 'User'}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                          <span className="text-lg font-bold text-white">
                            {(entry.displayName || entry.username || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-gray-900">{entry.displayName || entry.username || 'User'}</p>
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">@{entry.username}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Games</p>
                        <p className="font-semibold text-gray-900">{entry.gamesPlayed}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Wins</p>
                        <p className="font-semibold text-green-600">{entry.gamesWon}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Win Rate</p>
                        <p className="font-semibold text-blue-600">{entry.winRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Points</p>
                        <p className="font-semibold text-orange-600">{entry.totalPoints.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mt-6 p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">ℹ️</span>
            <div className="flex-1">
              <p className="text-sm text-blue-900">
                <strong>Leaderboard Updates:</strong> Rankings are updated in real-time as games complete. 
                {type === 'friends' 
                  ? ' Only your friends are shown here.' 
                  : ' All players are included in the global leaderboard.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
      </div>
    </>
  );
}

