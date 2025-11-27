/**
 * @module services/api
 * @description REST API client for Buck Euchre backend
 */

import type {
  JoinSessionResponse,
  CreateGameResponse,
  ListGamesResponse,
  GameState,
  AddAIPlayerResponse
} from '@buck-euchre/shared';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Create headers for authenticated requests
 */
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// ========== Authentication ==========

/**
 * Register a new user account
 */
export async function register(data: {
  username: string;
  email?: string;
  password: string;
  displayName: string;
}): Promise<JoinSessionResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    // Check if response is JSON before trying to parse
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to register');
    } else {
      // Backend returned HTML (likely a 404 or error page)
      await response.text(); // Consume response body
      throw new Error(`Server error (${response.status}): ${response.statusText}. Check that the backend is running at ${API_URL}`);
    }
  }

  return response.json();
}

/**
 * Login with email/username and password
 */
export async function login(emailOrUsername: string, password: string): Promise<JoinSessionResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emailOrUsername, password }),
  });

  if (!response.ok) {
    // Check if response is JSON before trying to parse
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to login');
    } else {
      // Backend returned HTML (likely a 404 or error page)
      await response.text(); // Consume response body
      throw new Error(`Server error (${response.status}): ${response.statusText}. Check that the backend is running at ${API_URL}`);
    }
  }

  return response.json();
}

/**
 * Logout (invalidate session)
 */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to logout');
  }
}

/**
 * Get current user profile and stats
 */
export async function getMe(): Promise<any> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get profile');
  }

  return response.json();
}

/**
 * Join a game session as a new player (legacy)
 */
export async function joinSession(playerName: string): Promise<JoinSessionResponse> {
  const response = await fetch(`${API_URL}/api/auth/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ playerName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to join session');
  }

  return response.json();
}

/**
 * Join a session as a guest player
 */
export async function joinAsGuest(): Promise<JoinSessionResponse> {
  const response = await fetch(`${API_URL}/api/auth/guest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to join as guest');
  }

  return response.json();
}

/**
 * Create a new game
 */
export async function createGame(): Promise<CreateGameResponse> {
  const response = await fetch(`${API_URL}/api/games`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create game');
  }

  return response.json();
}

/**
 * List all available games
 */
export async function listGames(): Promise<ListGamesResponse> {
  const response = await fetch(`${API_URL}/api/games`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to list games');
  }

  return response.json();
}

/**
 * Get user's active games
 */
export async function getUserGames(): Promise<ListGamesResponse> {
  const response = await fetch(`${API_URL}/api/games/my`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user games');
  }

  return response.json();
}

/**
 * Leave a game
 */
export async function leaveGame(gameId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/games/${gameId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to leave game');
  }
}

/**
 * Get current state of a specific game
 */
export async function getGameState(gameId: string): Promise<GameState> {
  const response = await fetch(`${API_URL}/api/games/${gameId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get game state');
  }

  return response.json();
}

/**
 * Add an AI player to a game
 */
export async function addAIToGame(
  gameId: string,
  options?: { difficulty?: 'easy' | 'medium' | 'hard'; name?: string }
): Promise<AddAIPlayerResponse> {
  const response = await fetch(`${API_URL}/api/games/${gameId}/ai`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(options || {}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add AI player');
  }

  return response.json();
}

/**
 * Check server health
 */
export async function checkHealth(): Promise<{ status: string; timestamp: number; database: string }> {
  const response = await fetch(`${API_URL}/health`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Server health check failed');
  }

  return response.json();
}

// ========== Friends ==========

/**
 * Send a friend request
 */
export async function sendFriendRequest(receiverId: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/friends/request`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ receiverId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send friend request');
  }

  return response.json();
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(friendshipId: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/friends/${friendshipId}/accept`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to accept friend request');
  }

  return response.json();
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(friendshipId: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/friends/${friendshipId}/decline`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to decline friend request');
  }

  return response.json();
}

/**
 * Get friends list
 */
export async function getFriends(): Promise<any> {
  const response = await fetch(`${API_URL}/api/friends`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get friends');
  }

  const data = await response.json();
  // API returns { friends: [...] }, return the array
  return data.friends || [];
}

/**
 * Get pending friend requests
 */
export async function getPendingFriendRequests(): Promise<any> {
  const response = await fetch(`${API_URL}/api/friends/pending`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get pending requests');
  }

  const data = await response.json();
  // API returns { requests: [...] }, return the array
  return data.requests || [];
}

/**
 * Remove a friend
 */
export async function removeFriend(friendId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/friends/${friendId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove friend');
  }
}

/**
 * Search users by username
 */
export async function searchUsers(query: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/friends/search?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to search users');
  }

  const data = await response.json();
  // API returns { users: [...] }, return the array
  return data.users || [];
}

// ========== Game Invitations ==========

/**
 * Send a game invitation
 */
export async function sendGameInvitation(gameId: string, inviteeId: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/games/${gameId}/invite`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ inviteeId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send invitation');
  }

  return response.json();
}

/**
 * Get my pending invitations
 */
export async function getInvitations(): Promise<any> {
  const response = await fetch(`${API_URL}/api/invitations`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get invitations');
  }

  return response.json();
}

/**
 * Accept a game invitation
 */
export async function acceptInvitation(invitationId: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/invitations/${invitationId}/accept`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to accept invitation');
  }

  return response.json();
}

/**
 * Decline a game invitation
 */
export async function declineInvitation(invitationId: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/invitations/${invitationId}/decline`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to decline invitation');
  }

  return response.json();
}

// ========== Leaderboards ==========

/**
 * Get global leaderboard
 */
export async function getGlobalLeaderboard(
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' = 'gamesWon',
  limit: number = 50
): Promise<any> {
  const response = await fetch(`${API_URL}/api/leaderboard/global?metric=${metric}&limit=${limit}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get leaderboard');
  }

  const data = await response.json();
  // API returns { leaderboard: [...] }, return the array
  return data.leaderboard || [];
}

/**
 * Get friends leaderboard
 */
export async function getFriendsLeaderboard(
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' = 'gamesWon'
): Promise<any> {
  const response = await fetch(`${API_URL}/api/leaderboard/friends?metric=${metric}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get friends leaderboard');
  }

  const data = await response.json();
  // API returns { leaderboard: [...] }, return the array
  return data.leaderboard || [];
}

// ========== Settings ==========

export interface UserSettings {
  id: string;
  userId: string;
  showCardOverlay: boolean;
  showTooltips: boolean;
  autoSortHand: boolean;
  bidSpeed: 'slow' | 'normal' | 'fast';
  animationSpeed: 'slow' | 'normal' | 'fast';
  soundEffects: boolean;
  showDebugConsole: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSettingsData {
  showCardOverlay?: boolean;
  showTooltips?: boolean;
  autoSortHand?: boolean;
  bidSpeed?: 'slow' | 'normal' | 'fast';
  animationSpeed?: 'slow' | 'normal' | 'fast';
  soundEffects?: boolean;
  showDebugConsole?: boolean;
}

/**
 * Get user settings
 */
export async function getUserSettings(): Promise<UserSettings> {
  const response = await fetch(`${API_URL}/api/settings`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to get user settings';
    try {
      const error = await response.json();
      errorMessage = error.message || error.details || errorMessage;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Update user settings
 */
export async function updateUserSettings(data: UpdateSettingsData): Promise<UserSettings> {
  const response = await fetch(`${API_URL}/api/settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to update user settings';
    try {
      const error = await response.json();
      errorMessage = error.message || error.details || errorMessage;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Reset user settings to defaults
 */
export async function resetUserSettings(): Promise<UserSettings> {
  const response = await fetch(`${API_URL}/api/settings/reset`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to reset user settings');
  }

  return response.json();
}
