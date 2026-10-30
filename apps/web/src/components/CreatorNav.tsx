'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, LogOut } from 'lucide-react';

// Shared top navbar for every Creator Workspace page, so navigation stays identical
const NAV_LINKS = [
  { href: '/dashboard', label: 'Pipeline & Deals' },
  { href: '/dashboard/wallet', label: 'Wallet & Payouts' }
];

interface CreatorNavProps {
  displayAlias: string;
  pointsBalance: number;
  onLogout: () => void;
}

export default function CreatorNav({ displayAlias, pointsBalance, onLogout }: CreatorNavProps) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        {/* Logo & Identity */}
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm tracking-tight shadow-sm"
          >
            E
          </Link>
          <span className="font-semibold text-sm text-slate-900">{displayAlias}</span>
        </div>

        <div className="flex items-center space-x-3">
          {NAV_LINKS.map((link) => {
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

          <div className="h-4 w-px bg-slate-200" />

          {/* Points Balance Pill linking to Wallet */}
          <Link
            href="/dashboard/wallet"
            className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 hover:border-slate-300 hover:bg-slate-100 transition"
          >
            <Coins className="h-4 w-4 text-amber-500" />
            <div className="flex items-baseline space-x-1">
              <span className="text-sm font-bold text-slate-900 tracking-tight">
                {pointsBalance.toLocaleString()}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">PTS</span>
            </div>
          </Link>

          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
