import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from '@/stores/uiStore';

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

function normalizeMessage(message?: string): string {
  return (message || '').toLowerCase();
}

export function isSessionExpiredError(
  message?: string,
  statusCode?: number,
  errorCode?: string
): boolean {
  if (statusCode === 401 || errorCode === 'AUTHENTICATION_REQUIRED') {
    return true;
  }

  const normalized = normalizeMessage(message);
  return (
    normalized.includes('invalid or expired') ||
    normalized.includes('expired session') ||
    normalized.includes('expired token') ||
    normalized.includes('authentication token required') ||
    normalized.includes('unauthorized')
  );
}

export function handleSessionExpired(
  message: string = SESSION_EXPIRED_MESSAGE
): void {
  const authStore = useAuthStore.getState();
  const alreadyLoggedOut = !authStore.isAuthenticated && !authStore.token;

  if (!alreadyLoggedOut) {
    authStore.logout();
  }

  useGameStore.getState().clearGame();

  const uiStore = useUIStore.getState();
  uiStore.setConnected(false);
  uiStore.setError(message);
}
