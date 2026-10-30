'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Coins, LogOut } from 'lucide-react';
import Sidebar, { PortalRole } from './Sidebar';
import { ToastProvider } from './Toast';
import { clearSession } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Pages fire this event after an action that changes the creator's balance
const SIDEBAR_COLLAPSED_KEY = 'evoc_sidebar_collapsed';

export const POINTS_REFRESH_EVENT = 'evoc:points-refresh';

export function refreshPointsBadge() {
  window.dispatchEvent(new Event(POINTS_REFRESH_EVENT));
}

const ROLE_BADGES: Record<PortalRole, { label: string; className: string }> = {
  CREATOR: { label: 'Creator', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  MERCHANT: { label: 'Merchant', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SUPER_ADMIN: { label: 'Super Admin', className: 'bg-amber-50 text-amber-700 border-amber-200' }
};

interface StoredUser {
  email?: string;
  role?: string;
  merchantProfile?: { brandName?: string };
  creatorProfile?: { displayAlias?: string };
}

const getDisplayName = (user: StoredUser) =>
  user.creatorProfile?.displayAlias || user.merchantProfile?.brandName || (user.role === 'SUPER_ADMIN' ? 'EVOC Ops' : user.email || 'User');

const getInitials = (name: string) =>
  name
    .split(/[\s—-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

interface AppShellProps {
  role: PortalRole;
  children: React.ReactNode;
}

export default function AppShell({ role, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);

  // Remember the desktop sidebar collapse choice
  useEffect(() => {
    try {
      setIsSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, prev ? '0' : '1');
      } catch {
        // ignore storage errors
      }
      return !prev;
    });
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('evoc_user');
      const parsed: StoredUser | null = stored ? JSON.parse(stored) : null;
      setUser(parsed?.role === role ? parsed : null);
    } catch {
      setUser(null);
    }
  }, [role, pathname]);

  // Live Points Counter (creators only)
  const loadPoints = useCallback(async () => {
    if (role !== 'CREATOR') return;
    const token = localStorage.getItem('evoc_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/creators/me/points`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPointsBalance(data.pointsBalance ?? 0);
      }
    } catch {
      // Header badge is non-critical; pages show their own error states
    }
  }, [role]);

  useEffect(() => {
    loadPoints();
    window.addEventListener(POINTS_REFRESH_EVENT, loadPoints);
    return () => window.removeEventListener(POINTS_REFRESH_EVENT, loadPoints);
  }, [loadPoints]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  const roleBadge = ROLE_BADGES[role];
  const displayName = user ? getDisplayName(user) : '';

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          role={role}
          isMobileOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)}
          onToggleCollapse={toggleSidebarCollapsed}
        />

        <div className={`transition-all duration-200 ${isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
          {/* Header Bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden lg:block" />

            <div className="flex items-center space-x-3">
              {role === 'CREATOR' && pointsBalance !== null && (
                <Link
                  href="/dashboard/wallet"
                  className="flex items-center space-x-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 transition"
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>{pointsBalance.toLocaleString()} PTS</span>
                </Link>
              )}

              {user ? (
                <>
                  <span className={`hidden sm:inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>

                  <div className="flex items-center space-x-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                      {getInitials(displayName)}
                    </span>
                    <span className="hidden md:block max-w-[200px] truncate text-xs font-semibold text-slate-800">
                      {displayName}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname || '/')}`}
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Sign In
                </Link>
              )}
            </div>
          </header>

          <div className="animate-fade-in">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
