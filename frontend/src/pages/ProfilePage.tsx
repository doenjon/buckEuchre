import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getMe } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface BidBreakdownChartProps {
  bids2: number;
  bids3: number;
  bids4: number;
  bids5: number;
  bids2Successful?: number;
  bids2Failed?: number;
  bids3Successful?: number;
  bids3Failed?: number;
  bids4Successful?: number;
  bids4Failed?: number;
  bids5Successful?: number;
  bids5Failed?: number;
}

function BidBreakdownChart({ 
  bids2, bids3, bids4, bids5,
  bids2Successful = 0, bids2Failed = 0,
  bids3Successful = 0, bids3Failed = 0,
  bids4Successful = 0, bids4Failed = 0,
  bids5Successful = 0, bids5Failed = 0
}: BidBreakdownChartProps) {
  // Prepare data for Recharts
  const chartData = [
    {
      name: '2',
      successful: Math.min(bids2Successful, bids2),
      failed: Math.min(bids2Failed, bids2),
      total: bids2,
      successRate: bids2 > 0 ? ((Math.min(bids2Successful, bids2) / bids2) * 100).toFixed(0) : '0'
    },
    {
      name: '3',
      successful: Math.min(bids3Successful, bids3),
      failed: Math.min(bids3Failed, bids3),
      total: bids3,
      successRate: bids3 > 0 ? ((Math.min(bids3Successful, bids3) / bids3) * 100).toFixed(0) : '0'
    },
    {
      name: '4',
      successful: Math.min(bids4Successful, bids4),
      failed: Math.min(bids4Failed, bids4),
      total: bids4,
      successRate: bids4 > 0 ? ((Math.min(bids4Successful, bids4) / bids4) * 100).toFixed(0) : '0'
    },
    {
      name: '5',
      successful: Math.min(bids5Successful, bids5),
      failed: Math.min(bids5Failed, bids5),
      total: bids5,
      successRate: bids5 > 0 ? ((Math.min(bids5Successful, bids5) / bids5) * 100).toFixed(0) : '0'
    },
  ];

  const total = bids2 + bids3 + bids4 + bids5;

  if (total === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-sm text-gray-400">No bids yet</p>
      </div>
    );
  }

  // Custom label component for success rate above bars
  const renderSuccessRateLabel = (props: any) => {
    const { x, y, width, payload } = props;
    const entry = chartData.find(d => d.name === payload);
    if (!entry || entry.total === 0) return null;
    
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#374151"
        textAnchor="middle"
        fontSize="12"
        fontWeight="600"
      >
        {entry.successRate}%
      </text>
    );
  };

  return (
    <div className="w-full h-64 relative min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 35, right: 10, left: 10, bottom: 25 }}
        >
          <XAxis 
            dataKey="name" 
            tick={{ fill: '#374151', fontSize: 12, fontWeight: 600 }}
            tickLine={{ stroke: '#9ca3af' }}
            label={{ value: 'Bid Amount', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis 
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={{ stroke: '#9ca3af' }}
            label={{ value: 'Bids', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            formatter={(value: number, name: string) => {
              if (name === 'successful') return [value, 'Successful'];
              if (name === 'failed') return [value, 'Failed'];
              return [value, name];
            }}
          />
          {/* Success bars (bottom, light blue) */}
          <Bar 
            dataKey="successful" 
            stackId="a" 
            fill="#93c5fd"
            radius={[0, 0, 4, 4]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`successful-${index}`} fill="#93c5fd" />
            ))}
          </Bar>
          {/* Failed bars (top, red) */}
          <Bar 
            dataKey="failed" 
            stackId="a" 
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`failed-${index}`} fill="#ef4444" />
            ))}
            <LabelList 
              dataKey="total" 
              content={renderSuccessRateLabel}
              position="top"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

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
    bucks?: number;
    bids2?: number;
    bids3?: number;
    bids4?: number;
    bids5?: number;
    bids2Successful?: number;
    bids2Failed?: number;
    bids3Successful?: number;
    bids3Failed?: number;
    bids4Successful?: number;
    bids4Failed?: number;
    bids5Successful?: number;
    bids5Failed?: number;
    timesFolded?: number;
    timesCouldFold?: number;
    totalRounds?: number;
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
            bucks: data.stats.bucks || 0,
            bids2: data.stats.bids2 || 0,
            bids3: data.stats.bids3 || 0,
            bids4: data.stats.bids4 || 0,
            bids5: data.stats.bids5 || 0,
            bids2Successful: data.stats.bids2Successful || 0,
            bids2Failed: data.stats.bids2Failed || 0,
            bids3Successful: data.stats.bids3Successful || 0,
            bids3Failed: data.stats.bids3Failed || 0,
            bids4Successful: data.stats.bids4Successful || 0,
            bids4Failed: data.stats.bids4Failed || 0,
            bids5Successful: data.stats.bids5Successful || 0,
            bids5Failed: data.stats.bids5Failed || 0,
            timesFolded: data.stats.timesFolded || 0,
            timesCouldFold: data.stats.timesCouldFold || 0,
            totalRounds: data.stats.totalRounds || 0,
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-emerald-700">Loading profile...</p>
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
          <Card className="p-6 max-w-md bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <div className="text-center">
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 font-medium">{error || 'Profile not found'}</p>
              </div>
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
  const foldRate = stats && stats.timesCouldFold > 0
    ? ((stats.timesFolded || 0) / stats.timesCouldFold * 100).toFixed(1)
    : '0.0';

  return (
    <>
      <Header />
      <div className="min-h-screen bg-green-50">

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
          <div className="flex items-center space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName || profile.username || 'User'}
                  className="w-24 h-24 rounded-full border-4 border-emerald-500"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center border-4 border-emerald-500">
                  <span className="text-3xl font-bold text-white">
                    {(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h2 className="text-3xl font-bold text-emerald-900">{profile.displayName || profile.username || 'User'}</h2>
                {isGuest && (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
                    Guest
                  </span>
                )}
              </div>
              <p className="text-emerald-700 mt-1">@{profile.username}</p>
              {profile.email && (
                <p className="text-emerald-600 text-sm mt-1">{profile.email}</p>
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
        {stats ? (
          <div className="space-y-8">
            {/* Overview Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Overview</h3>
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Games Played</p>
                  <p className="text-xl font-bold text-gray-900">{stats.gamesPlayed}</p>
                </Card>
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Rounds</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalRounds || 0}</p>
                </Card>
              </div>
            </div>

            {/* Performance Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Performance</h3>
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Win Rate</p>
                  <p className="text-xl font-bold text-green-600">{winRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.gamesWon}W - {stats.gamesLost}L</p>
                </Card>
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tricks Taken</p>
                  <p className="text-xl font-bold text-blue-600">{stats.totalTricksTaken}</p>
                </Card>
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Points/Game</p>
                  <p className="text-xl font-bold text-orange-600">{avgPointsPerGame}</p>
                </Card>
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Points</p>
                  <p className="text-xl font-bold text-emerald-700">{stats.totalPoints}</p>
                </Card>
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bucks</p>
                  <p className="text-xl font-bold text-red-600">{stats.bucks || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Times set</p>
                </Card>
              </div>
            </div>

            {/* Bidding Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Bidding</h3>
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bid Success Rate</p>
                  <p className="text-xl font-bold text-purple-600">{bidSuccessRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.successfulBids} / {stats.totalBids} successful</p>
                </Card>
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fold Rate</p>
                  <p className="text-xl font-bold text-purple-600">{foldRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.timesFolded || 0} / {stats.timesCouldFold || 0} folds</p>
                </Card>
                <Card className="p-3 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-sm hover:shadow-md transition-shadow col-span-2 w-full">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Bid Breakdown</p>
                  <BidBreakdownChart 
                    bids2={stats.bids2 || 0}
                    bids3={stats.bids3 || 0}
                    bids4={stats.bids4 || 0}
                    bids5={stats.bids5 || 0}
                    bids2Successful={stats.bids2Successful || 0}
                    bids2Failed={stats.bids2Failed || 0}
                    bids3Successful={stats.bids3Successful || 0}
                    bids3Failed={stats.bids3Failed || 0}
                    bids4Successful={stats.bids4Successful || 0}
                    bids4Failed={stats.bids4Failed || 0}
                    bids5Successful={stats.bids5Successful || 0}
                    bids5Failed={stats.bids5Failed || 0}
                  />
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <h4 className="text-lg font-semibold text-emerald-800 mb-2">No Stats Yet</h4>
            <p className="text-emerald-700 mb-4">
              Play some games to start tracking your statistics!
            </p>
            <Button onClick={() => navigate('/lobby')} variant="primary">
              Play Now
            </Button>
          </Card>
        )}
      </div>
      </div>
    </>
  );
}

