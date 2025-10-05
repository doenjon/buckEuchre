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

/**
 * Join a game session as a new player
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
