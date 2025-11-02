import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getMe } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';

interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  isGuest: boolean;
  stats?: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    totalPoints: number;
    totalBids: number;
    successfulBids: number;
    totalTricksTaken: number;
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isGuest, checkAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[ProfilePage] useEffect triggered, checkAuth:', checkAuth());
    if (!checkAuth()) {
      console.log('[ProfilePage] Not authenticated, redirecting to login');
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        console.log('[ProfilePage] Fetching profile...');
        setLoading(true);
        const data = await getMe();
        console.log('[ProfilePage] Profile fetched:', data);
        
        // API returns { user: {...}, stats: {...} }, transform to flat structure
        const profileData: UserProfile = {
          userId: data.user.id,
          username: data.user.username,
          displayName: data.user.displayName || data.user.username || 'User',
          email: data.user.email,
          avatarUrl: data.user.avatarUrl,
          isGuest: data.user.isGuest,
          stats: data.stats ? {
            gamesPlayed: data.stats.gamesPlayed,
            gamesWon: data.stats.gamesWon,
            gamesLost: data.stats.gamesLost,
            totalPoints: data.stats.totalPoints,
            totalBids: data.stats.totalBids,
            successfulBids: data.stats.successfulBids,
            totalTricksTaken: data.stats.totalTricksTaken,
          } : undefined,
        };
        
        console.log('[ProfilePage] Transformed profile:', profileData);
        setProfile(profileData);
      } catch (err) {
        console.error('[ProfilePage] Error fetching profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [checkAuth, navigate]);

  if (loading) {
    console.log('[ProfilePage] Loading state');
    return (
      <>
        <Header />
        <div className="min-h-screen bg-green-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !profile) {
    console.log('[ProfilePage] Error or no profile:', { error, hasProfile: !!profile });
    return (
      <>
        <Header />
        <div className="min-h-screen bg-green-50 flex items-center justify-center">
          <Card className="p-6 max-w-md">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error || 'Profile not found'}</p>
              <Button onClick={() => navigate('/lobby')}>Back to Lobby</Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  const stats = profile.stats;
  const winRate = stats && stats.gamesPlayed > 0 
    ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1) 
    : '0.0';
  const bidSuccessRate = stats && stats.totalBids > 0
    ? ((stats.successfulBids / stats.totalBids) * 100).toFixed(1)
    : '0.0';
  const avgPointsPerGame = stats && stats.gamesPlayed > 0
    ? (stats.totalPoints / stats.gamesPlayed).toFixed(1)
    : '0.0';

  return (
    <>
      <Header />
      <div className="min-h-screen bg-green-50">

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-center space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName || profile.username || 'User'}
                  className="w-24 h-24 rounded-full border-4 border-green-500"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center border-4 border-green-500">
                  <span className="text-3xl font-bold text-white">
                    {(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h2 className="text-3xl font-bold text-gray-900">{profile.displayName || profile.username || 'User'}</h2>
                {isGuest && (
                  <span className="px-3 py-1 bg-gray-200 text-gray-700 text-sm font-medium rounded-full">
                    Guest
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">@{profile.username}</p>
              {profile.email && (
                <p className="text-gray-500 text-sm mt-1">{profile.email}</p>
              )}
            </div>
          </div>

          {isGuest && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Guest Account:</strong> Stats and social features are limited. 
                <button className="ml-2 text-yellow-900 underline font-medium">
                  Create an account
                </button> to unlock all features!
              </p>
            </div>
          )}
        </Card>

        {/* Stats Section */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Game Statistics</h3>
          
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Games Played */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Games Played</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stats.gamesPlayed}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🎮</span>
                  </div>
                </div>
              </Card>

              {/* Win Rate */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Win Rate</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{winRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.gamesWon}W - {stats.gamesLost}L
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🏆</span>
                  </div>
                </div>
              </Card>

              {/* Bid Success Rate */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Bid Success</p>
                    <p className="text-3xl font-bold text-purple-600 mt-1">{bidSuccessRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.successfulBids} / {stats.totalBids}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🎯</span>
                  </div>
                </div>
              </Card>

              {/* Average Points */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Avg Points/Game</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{avgPointsPerGame}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.totalPoints} total
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⭐</span>
                  </div>
                </div>
              </Card>

              {/* Total Tricks */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Tricks Taken</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{stats.totalTricksTaken}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🃏</span>
                  </div>
                </div>
              </Card>

              {/* Games Won */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Games Won</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{stats.gamesWon}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                </div>
              </Card>

              {/* Games Lost */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Games Lost</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">{stats.gamesLost}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">❌</span>
                  </div>
                </div>
              </Card>

              {/* Total Points */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Points</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.totalPoints}</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">💎</span>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <span className="text-6xl">🎮</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">No Stats Yet</h4>
              <p className="text-gray-600 mb-4">
                Play some games to start tracking your statistics!
              </p>
              <Button onClick={() => navigate('/lobby')} className="bg-green-600 hover:bg-green-700">
                Play Now
              </Button>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => navigate('/lobby')}
              className="bg-green-600 hover:bg-green-700 py-6"
            >
              <div className="text-center">
                <p className="text-lg font-semibold">Play Game</p>
                <p className="text-sm opacity-90">Join or create a game</p>
              </div>
            </Button>
            <Button 
              onClick={() => navigate('/friends')}
              className="bg-blue-600 hover:bg-blue-700 py-6"
            >
              <div className="text-center">
                <p className="text-lg font-semibold">Friends</p>
                <p className="text-sm opacity-90">Manage your friends</p>
              </div>
            </Button>
            <Button 
              onClick={() => navigate('/leaderboard')}
              className="bg-purple-600 hover:bg-purple-700 py-6"
            >
              <div className="text-center">
                <p className="text-lg font-semibold">Leaderboard</p>
                <p className="text-sm opacity-90">See top players</p>
              </div>
            </Button>
          </div>
        </Card>
      </div>
      </div>
    </>
  );
}

