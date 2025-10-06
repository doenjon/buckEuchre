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
    <header className="relative z-30 border-b border-white/10 bg-white/5 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold uppercase tracking-[0.35em] text-emerald-200">
            BE
          </span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Card Club</span>
            <h1 className="text-lg font-semibold text-white sm:text-xl">Buck Euchre</h1>
          </div>
        </div>

        {playerName && (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end text-right">
              <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/70">Playing as</span>
              <span className="text-sm font-semibold text-white">{playerName}</span>
            </div>
            {isGuest && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-100">
                Guest
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
