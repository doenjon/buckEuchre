/**
 * @module services/api
 * @description REST API client for Buck Euchre backend
 */

import type { 
  AuthResponse, 
  CreateGameResponse, 
  ListGamesResponse,
  GameState 
} from '@buck-euchre/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

/**
 * Join a game session as a new player
 */
export async function joinSession(playerName: string): Promise<AuthResponse> {
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
