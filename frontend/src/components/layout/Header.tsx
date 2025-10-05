/**
 * @module components/layout/Header
 * @description Header component with player info and navigation
 */

import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function Header() {
  const { playerName, isGuest, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-green-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Buck Euchre</h1>
        </div>
        
        {playerName && (
          <div className="flex items-center gap-4">
            <span className="text-sm flex items-center gap-2">
              <span>
                Playing as: <strong>{playerName}</strong>
              </span>
              {isGuest && (
                <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                  Guest
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-green-600"
            >
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
