import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  getFriends,
  getPendingFriendRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';

interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

interface FriendRequest {
  id: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl?: string;
  createdAt: string;
}

interface SearchUser {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { checkAuth, userId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!checkAuth()) {
      navigate('/login');
      return;
    }

    loadFriendsData();
  }, [checkAuth, navigate]);

  const loadFriendsData = async () => {
    try {
      setLoading(true);
      const [friendsData, requestsData] = await Promise.all([
        getFriends(),
        getPendingFriendRequests(),
      ]);
      
      // API returns { friends: [...] }, extract the array
      const rawFriendsArray = Array.isArray(friendsData) ? friendsData : (friendsData.friends || []);
      const rawRequestsArray = Array.isArray(requestsData) ? requestsData : (requestsData.requests || []);
      
      // Transform friends: backend returns nested friend object, frontend expects flat properties
      const friendsArray: Friend[] = rawFriendsArray.map((f: any) => ({
        friendshipId: f.friendshipId || f.id || '',
        userId: f.friend?.id || f.userId || '',
        username: f.friend?.username || f.username || '',
        displayName: f.friend?.displayName || f.displayName || f.friend?.username || 'Unknown',
        avatarUrl: f.friend?.avatarUrl || f.avatarUrl,
      }));
      
      // Transform requests: backend returns nested requester object, frontend expects flat sender* properties
      const requestsArray: FriendRequest[] = rawRequestsArray.map((req: any) => ({
        id: req.id,
        senderId: req.requester?.id || req.senderId || '',
        senderUsername: req.requester?.username || req.senderUsername || '',
        senderDisplayName: req.requester?.displayName || req.senderDisplayName || req.requester?.username || 'Unknown',
        senderAvatarUrl: req.requester?.avatarUrl || req.senderAvatarUrl,
        createdAt: req.createdAt,
      }));
      
      console.log('[FriendsPage] Friends data:', friendsData, 'Extracted:', friendsArray);
      console.log('[FriendsPage] Requests data:', requestsData, 'Extracted:', requestsArray);
      
      setFriends(friendsArray);
      setRequests(requestsArray);
    } catch (err) {
      console.error('[FriendsPage] Error loading friends:', err);
      setError(err instanceof Error ? err.message : 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setError('');
      const results = await searchUsers(searchQuery);
      // Filter out self and existing friends
      const friendUserIds = friends.map(f => f.userId);
      const filtered = results.filter(
        (u: SearchUser) => u.userId !== userId && !friendUserIds.includes(u.userId)
      );
      setSearchResults(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      setActionLoading(targetUserId);
      await sendFriendRequest(targetUserId);
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.userId !== targetUserId));
      setError('Friend request sent!');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      setActionLoading(friendshipId);
      await acceptFriendRequest(friendshipId);
      await loadFriendsData();
      setError('Friend request accepted!');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      setActionLoading(friendshipId);
      await declineFriendRequest(friendshipId);
      setRequests(prev => prev.filter(r => r.id !== friendshipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (friendId: string, friendshipId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) {
      return;
    }

    try {
      setActionLoading(friendId);
      await removeFriend(friendId);
      setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-emerald-700">Loading friends...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-green-50">

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error/Success Message */}
        {error && (
          <div className={`mb-4 p-3 rounded-md ${
            error.includes('sent') || error.includes('accepted')
              ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-700 backdrop-blur-sm'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex mb-6 bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-md border border-emerald-200/50">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'friends'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors relative ${
              activeTab === 'requests'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Requests ({requests.length})
            {requests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Add Friends
          </button>
        </div>

        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <div>
            {friends.length === 0 ? (
              <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
                <div className="text-emerald-400 mb-4">
                  <span className="text-6xl">👥</span>
                </div>
                <h3 className="text-lg font-semibold text-emerald-800 mb-2">No Friends Yet</h3>
                <p className="text-emerald-700 mb-4">
                  Start by searching for users to add as friends!
                </p>
                <Button 
                  onClick={() => setActiveTab('search')}
                  variant="primary"
                >
                  Search Users
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {friends.map((friend) => (
                  <Card key={friend.friendshipId} className="p-4 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between space-x-3">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Avatar */}
                        {friend.avatarUrl ? (
                          <img
                            src={friend.avatarUrl}
                            alt={friend.displayName || friend.username || 'User'}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                            <span className="text-lg font-bold text-white">
                              {(friend.displayName || friend.username || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-emerald-900 truncate">
                            {friend.displayName || friend.username || 'Unknown User'}
                          </p>
                          <p className="text-sm text-emerald-600 truncate">
                            @{friend.username || 'unknown'}
                          </p>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveFriend(friend.userId, friend.friendshipId)}
                        disabled={actionLoading === friend.userId}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md text-sm py-2 px-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {actionLoading === friend.userId ? '...' : 'Remove'}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div>
            {requests.length === 0 ? (
              <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
                <div className="text-emerald-400 mb-4">
                  <span className="text-6xl">📬</span>
                </div>
                <h3 className="text-lg font-semibold text-emerald-800 mb-2">No Pending Requests</h3>
                <p className="text-emerald-700">
                  You have no friend requests at this time.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id} className="p-4 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        {/* Avatar */}
                        {request.senderAvatarUrl ? (
                          <img
                            src={request.senderAvatarUrl}
                            alt={request.senderDisplayName || 'User'}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                            <span className="text-lg font-bold text-white">
                              {(request.senderDisplayName || request.senderUsername || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-900">{request.senderDisplayName || request.senderUsername || 'Unknown User'}</p>
                          <p className="text-sm text-emerald-600">@{request.senderUsername || 'unknown'}</p>
                          <p className="text-xs text-emerald-500 mt-1">
                            {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={actionLoading === request.id}
                          variant="primary"
                          className="px-4 py-2"
                        >
                          {actionLoading === request.id ? '...' : 'Accept'}
                        </Button>
                        <Button
                          onClick={() => handleDeclineRequest(request.id)}
                          disabled={actionLoading === request.id}
                          variant="outline"
                          className="px-4 py-2"
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div>
            {/* Search Bar */}
            <Card className="p-4 mb-6 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-md">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by username or display name..."
                  className="flex-1 px-4 py-2 bg-white/90 border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-emerald-900 placeholder:text-emerald-400"
                />
                <Button
                  onClick={handleSearch}
                  variant="primary"
                  className="px-6"
                >
                  Search
                </Button>
              </div>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((user) => (
                  <Card key={user.userId} className="p-4 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center space-x-3 mb-4">
                      {/* Avatar */}
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName || user.username || 'User'}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                          <span className="text-lg font-bold text-white">
                            {(user.displayName || user.username || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-emerald-900 truncate">
                          {user.displayName || user.username || 'Unknown User'}
                        </p>
                        <p className="text-sm text-emerald-600 truncate">
                          @{user.username || 'unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Add Button */}
                    <Button
                      onClick={() => handleSendRequest(user.userId)}
                      disabled={actionLoading === user.userId}
                      variant="primary"
                      className="w-full"
                    >
                      {actionLoading === user.userId ? 'Sending...' : 'Add Friend'}
                    </Button>
                  </Card>
                ))}
              </div>
            ) : searchQuery ? (
              <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
                <div className="text-emerald-400 mb-4">
                  <span className="text-6xl">🔍</span>
                </div>
                <h3 className="text-lg font-semibold text-emerald-800 mb-2">No Results Found</h3>
                <p className="text-emerald-700">
                  No users found matching "{searchQuery}". Try a different search term.
                </p>
              </Card>
            ) : (
              <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
                <div className="text-emerald-400 mb-4">
                  <span className="text-6xl">🔍</span>
                </div>
                <h3 className="text-lg font-semibold text-emerald-800 mb-2">Search for Users</h3>
                <p className="text-emerald-700">
                  Enter a username or display name to find users to add as friends.
                </p>
              </Card>
            )}
          </div>
        )}
        </div>
      </div>
    </>
  );
}

