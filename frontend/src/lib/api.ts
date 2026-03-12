/**
 * @module lib/api
 * @description Axios-like API client wrapper for frontend
 */

import {
  handleSessionExpired,
  isSessionExpiredError,
  SESSION_EXPIRED_MESSAGE,
} from '@/lib/authSession';

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

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    const error = await response.json().catch(() => null);
    if (error?.message) {
      return error.message;
    }
  } else {
    await response.text().catch(() => null);
  }

  return `HTTP ${response.status}: ${response.statusText}`;
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const message = await readErrorMessage(response);
  if (isSessionExpiredError(message, response.status)) {
    handleSessionExpired();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  throw new Error(message);
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

/**
 * API client with axios-like interface
 */
export const api = {
  /**
   * Perform a GET request
   */
  async get<T = any>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    await ensureOk(response);

    const data = await response.json();

    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  },

  /**
   * Perform a POST request
   */
  async post<T = any>(url: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    await ensureOk(response);

    const data = await response.json();

    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  },

  /**
   * Perform a PUT request
   */
  async put<T = any>(url: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    await ensureOk(response);

    const data = await response.json();

    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  },

  /**
   * Perform a DELETE request
   */
  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    await ensureOk(response);

    // DELETE might return empty response
    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : null;

    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  },

  /**
   * Perform a PATCH request
   */
  async patch<T = any>(url: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    await ensureOk(response);

    const data = await response.json();

    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  },
};
