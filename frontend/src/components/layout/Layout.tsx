/**
 * @module components/layout/Layout
 * @description Main layout wrapper component
 */

import { ReactNode } from 'react';
import { Header } from './Header';
import { useUIStore } from '@/stores/uiStore';

export interface LayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export function Layout({ children, showHeader = true }: LayoutProps) {
  const { notification } = useUIStore();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]" />

      {showHeader && <Header />}

      {notification && (
        <div className="fixed top-4 right-4 z-50 rounded-3xl border border-white/15 bg-white/10 px-5 py-4 text-sm font-medium shadow-[0_25px_65px_-35px_rgba(16,185,129,0.65)] backdrop-blur">
          <p>{notification}</p>
        </div>
      )}

      <main className="relative z-10">{children}</main>
    </div>
  );
}
