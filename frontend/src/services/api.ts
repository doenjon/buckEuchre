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

type FetchJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  options?: FetchJsonOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const retries = options?.retries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 300;
  const retryOnStatuses = options?.retryOnStatuses ?? [429, 502, 503, 504];

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const shouldRetry = retryOnStatuses.includes(response.status) && attempt < retries;
        let message = `HTTP ${response.status}: ${response.statusText}`;

        // Try to read JSON error if available
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json().catch(() => null);
          if (error?.message) message = error.message;
        } else {
          await response.text().catch(() => null);
        }

        if (!shouldRetry) {
          throw new Error(message);
        }

        lastError = new Error(message);
        const backoff = retryDelayMs * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(Math.min(5000, backoff + jitter));
        continue;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      lastError = err;
      const isAbort = err?.name === 'AbortError';
      const isNetwork = err instanceof TypeError; // fetch() network errors

      const shouldRetry = (isAbort || isNetwork) && attempt < retries;
      if (!shouldRetry) {
        if (isAbort) throw new Error('Request timed out');
        throw err instanceof Error ? err : new Error(String(err));
      }

      const backoff = retryDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 200);
      await sleep(Math.min(5000, backoff + jitter));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Request failed'));
}

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Create headers for authenticated requests
 */
function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
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
  const url = `${API_URL}/api/auth/guest`;
  console.log('Attempting guest login to:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Guest login response status:', response.status, response.statusText);

    if (!response.ok) {
      // Check if response is JSON before trying to parse
      const contentType = response.headers.get('content-type');
      console.log('Response content-type:', contentType);
      
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        console.error('Guest login error response:', error);
        throw new Error(error.message || 'Failed to join as guest');
      } else {
        // Backend returned HTML (likely a 404 or error page)
        const text = await response.text();
        console.error('Guest login non-JSON error response:', text.substring(0, 200));
        throw new Error(`Server error (${response.status}): ${response.statusText}. Check that the backend is running at ${API_URL}`);
      }
    }

    const data = await response.json();
    console.log('Guest login success:', { userId: data.userId, username: data.username });
    return data;
  } catch (error) {
    console.error('Guest login catch block:', {
      error,
      errorType: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      url,
      apiUrl: API_URL,
    });
    
    // Handle network errors, CORS errors, etc.
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to backend at ${API_URL}. Make sure the backend is running.`);
    }
    // Re-throw if it's already an Error with a message
    if (error instanceof Error) {
      throw error;
    }
    // Fallback for unknown errors
    throw new Error(`Failed to join as guest: ${String(error)}`);
  }
}

/**
 * Create a rematch game with the same 4 players
 */
export async function createRematchGame(oldGameId: string): Promise<CreateGameResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/games/${oldGameId}/rematch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create rematch: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new game
 */
export async function createGame(): Promise<CreateGameResponse> {
  return fetchJson<CreateGameResponse>(
    `${API_URL}/api/games`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    },
    { timeoutMs: 12000, retries: 2 }
  );
}

/**
 * List all available games
 */
export async function listGames(): Promise<ListGamesResponse> {
  return fetchJson<ListGamesResponse>(
    `${API_URL}/api/games`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
      cache: 'no-store',
    },
    { timeoutMs: 10000, retries: 2 }
  );
}

/**
 * Get user's active games
 */
export async function getUserGames(): Promise<ListGamesResponse> {
  const headers = getAuthHeaders();
  return fetchJson<ListGamesResponse>(
    `${API_URL}/api/games/my`,
    {
      method: 'GET',
      headers,
      cache: 'no-store',
    },
    { timeoutMs: 10000, retries: 2 }
  );
}

/**
 * Leave a game
 */
export async function leaveGame(gameId: string): Promise<void> {
  console.log(`[leaveGame] Attempting to leave game: ${gameId}`);
  const headers = getAuthHeaders();
  
  const response = await fetch(`${API_URL}/api/games/${gameId}`, {
    method: 'DELETE',
    headers,
  });

  console.log(`[leaveGame] Response status: ${response.status}`);

  if (!response.ok) {
    const error = await response.json();
    console.error(`[leaveGame] Error response:`, error);
    throw new Error(error.message || 'Failed to leave game');
  }

  const data = await response.json();
  console.log(`[leaveGame] Success:`, data);
  return data;
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
  return fetchJson<AddAIPlayerResponse>(
    `${API_URL}/api/games/${gameId}/ai`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(options || {}),
    },
    { timeoutMs: 15000, retries: 3 }
  );
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
  // API returns { users: [...] }, map id to userId for frontend
  const users = data.users || [];
  return users.map((user: any) => ({
    ...user,
    userId: user.id,
  }));
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
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' | 'totalRounds' | 'foldRate' | 'bucks' | 'tricksWon' | 'avgPointsPerGame' | 'avgPointsPerRound' = 'gamesWon',
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
  metric: 'gamesWon' | 'winRate' | 'totalPoints' | 'bidSuccessRate' | 'totalRounds' | 'foldRate' | 'bucks' | 'tricksWon' | 'avgPointsPerGame' | 'avgPointsPerRound' = 'gamesWon'
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

// ========== Bug Reports ==========

export interface BugReportData {
  description: string;
  logs: string;
  userAgent: string;
  url: string;
  timestamp: string;
}

/**
 * Submit a bug report
 */
export async function submitBugReport(data: BugReportData): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/api/bugs/report`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to submit bug report';
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
