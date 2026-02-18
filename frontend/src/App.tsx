/**
 * @module App
 * @description Root component for Buck Euchre frontend with routing
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import { ConsoleLogger } from './components/ConsoleLogger';
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';
import { handleSessionExpired } from './lib/authSession';

function AuthExpirationWatcher() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const expiresAt = useAuthStore((state) => state.expiresAt);

  useEffect(() => {
    if (!isAuthenticated || !expiresAt) {
      return;
    }

    const msUntilExpiration = expiresAt - Date.now();

    if (msUntilExpiration <= 0) {
      handleSessionExpired();
      navigate('/', { replace: true });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleSessionExpired();
      navigate('/', { replace: true });
    }, msUntilExpiration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [expiresAt, isAuthenticated, navigate]);

  return null;
}

function App() {
  const { showDebugConsole } = useSettingsStore();

  return (
    <BrowserRouter>
      {showDebugConsole && <ConsoleLogger />}
      <AuthExpirationWatcher />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/game/:gameId" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
