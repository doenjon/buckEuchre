/**
 * @module lib/api
 * @description Axios-like API client wrapper for frontend
 */

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

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

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

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

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

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

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

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

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

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();

    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  },
};
