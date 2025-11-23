/**
 * @module components/layout/Header
 * @description Header component with player info and navigation
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';

export function Header() {
  const { displayName, username, isGuest, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="relative z-30 border-b border-white/10 bg-white/5 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button 
          onClick={() => navigate('/lobby')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold uppercase tracking-[0.35em] text-emerald-200">
            BE
          </span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Card Club</span>
            <h1 className="text-lg font-semibold text-white sm:text-xl">Buck Euchre</h1>
          </div>
        </button>

        {/* Navigation Links */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => navigate('/lobby')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/lobby')
                  ? 'bg-white/10 text-white'
                  : 'text-emerald-200/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              Lobby
            </button>
            <button
              onClick={() => navigate('/arena')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/arena')
                  ? 'bg-white/10 text-white'
                  : 'text-emerald-200/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              AI Arena
            </button>
            {!isGuest && (
              <>
                <button
                  onClick={() => navigate('/profile')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/profile')
                      ? 'bg-white/10 text-white'
                      : 'text-emerald-200/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  Profile
                </button>
                <button
                  onClick={() => navigate('/friends')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/friends')
                      ? 'bg-white/10 text-white'
                      : 'text-emerald-200/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  Friends
                </button>
                <button
                  onClick={() => navigate('/leaderboard')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/leaderboard')
                      ? 'bg-white/10 text-white'
                      : 'text-emerald-200/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  Leaderboard
                </button>
              </>
            )}
          </nav>
        )}

        {/* User Menu */}
        {isAuthenticated && (
          <div className="flex items-center gap-4">
            {/* Guest Badge */}
            {isGuest && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-100">
                Guest
              </span>
            )}

            {/* User Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 hover:bg-white/15 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {(displayName || username || 'G').charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="hidden sm:block text-sm font-medium text-white">
                  {displayName || username || 'Guest'}
                </span>
                <svg
                  className={`w-4 h-4 text-emerald-200 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-white/20 bg-gray-900/95 backdrop-blur shadow-xl">
                  <div className="py-1">
                    {/* Mobile Navigation Links */}
                    <div className="md:hidden">
                      <button
                        onClick={() => {
                          navigate('/lobby');
                          setMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                      >
                        🎮 Lobby
                      </button>
                      <button
                        onClick={() => {
                          navigate('/arena');
                          setMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                      >
                        ⚔️ AI Arena
                      </button>
                      {!isGuest && (
                        <>
                          <button
                            onClick={() => {
                              navigate('/profile');
                              setMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                          >
                            👤 Profile
                          </button>
                          <button
                            onClick={() => {
                              navigate('/friends');
                              setMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                          >
                            👥 Friends
                          </button>
                          <button
                            onClick={() => {
                              navigate('/leaderboard');
                              setMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                          >
                            🏆 Leaderboard
                          </button>
                          <button
                            onClick={() => {
                              navigate('/settings');
                              setMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                          >
                            ⚙️ Settings
                          </button>
                          <div className="border-t border-white/10 my-1"></div>
                        </>
                      )}
                    </div>

                    {/* User Info */}
                    {!isGuest && username && (
                      <div className="px-4 py-2 text-xs text-gray-400">
                        @{username}
                      </div>
                    )}

                    {/* Guest Upgrade Prompt */}
                    {isGuest && (
                      <>
                        <div className="px-4 py-2">
                          <p className="text-xs text-gray-400 mb-2">
                            Create an account to save stats!
                          </p>
                          <button
                            onClick={() => {
                              navigate('/login');
                              setMenuOpen(false);
                            }}
                            className="w-full px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                          >
                            Create Account
                          </button>
                        </div>
                        <div className="border-t border-white/10 my-1"></div>
                      </>
                    )}

                    {/* Logout */}
                    <button
                      onClick={() => {
                        handleLogout();
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-white/10"
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
