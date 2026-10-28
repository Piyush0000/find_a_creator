'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { clearRoleCookie } from '@/lib/session';

// Shared top navbar for every Merchant Portal page, so navigation stays identical
const NAV_LINKS = [
  { href: '/creators', label: 'Discover Creators' },
  { href: '/collabs', label: 'Collabs Hub' }
];

interface StoredUser {
  email?: string;
  role?: string;
  merchantProfile?: { brandName?: string };
}

export default function MerchantNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('evoc_user');
      const parsed: StoredUser | null = stored ? JSON.parse(stored) : null;
      setCurrentUser(parsed?.role === 'MERCHANT' ? parsed : null);
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('evoc_token');
    localStorage.removeItem('evoc_role');
    localStorage.removeItem('evoc_user');
    localStorage.removeItem('evoc_merchant_token');
    localStorage.removeItem('evoc_admin_token');
    clearRoleCookie();
    setCurrentUser(null);
    router.push('/login');
  };

  const brandName = currentUser?.merchantProfile?.brandName || 'Merchant';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <Link
            href="/creators"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm tracking-tight"
          >
            E
          </Link>
          <span className="font-semibold text-sm text-slate-900">EVOC Labs</span>
        </div>

        <div className="flex items-center space-x-3">
          {currentUser &&
            NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-medium transition px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

          {!currentUser && (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname || '/creators')}`}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 transition px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              Sign In
            </Link>
          )}

          {currentUser && (
            <>
              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center space-x-2 pl-2 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white font-bold text-[11px] shadow-sm">
                  {brandName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{brandName}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{currentUser.email}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
