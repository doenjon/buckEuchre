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
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600">
      {showHeader && <Header />}
      
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
          <p className="text-sm text-gray-900">{notification}</p>
        </div>
      )}
      
      <main>{children}</main>
    </div>
  );
}
