'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Kanban,
  Wallet,
  Users,
  FileText,
  Inbox,
  Video,
  ShieldAlert,
  X,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

export type PortalRole = 'CREATOR' | 'MERCHANT' | 'SUPER_ADMIN';

// Role-based navigation for the unified app shell
export const NAV_LINKS: Record<PortalRole, Array<{ href: string; label: string; Icon: typeof Wallet }>> = {
  CREATOR: [
    { href: '/dashboard', label: 'Deals Kanban', Icon: Kanban },
    { href: '/dashboard/wallet', label: 'Shopping Points', Icon: Wallet }
  ],
  MERCHANT: [
    { href: '/collabs', label: 'Collabs Dashboard', Icon: Inbox },
    { href: '/creators', label: 'Find Creators', Icon: Users },
    { href: '/brief', label: 'Create Brief', Icon: FileText }
  ],
  SUPER_ADMIN: [
    { href: '/moderation', label: 'Video Moderation', Icon: Video },
    { href: '/admin/security-flags', label: 'Security Flags', Icon: ShieldAlert }
  ]
};

const PORTAL_NAMES: Record<PortalRole, string> = {
  CREATOR: 'Creator Workspace',
  MERCHANT: 'Merchant Portal',
  SUPER_ADMIN: 'Admin Console'
};

interface SidebarProps {
  role: PortalRole;
  isMobileOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export default function Sidebar({ role, isMobileOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  // The drawer on mobile/tablet always shows labels; collapsing only applies on desktop
  const hideLabels = isCollapsed ? 'lg:hidden' : '';

  return (
    <>
      {/* Mobile / tablet overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:translate-x-0 ${
          isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand Mark */}
        <div
          className={`flex h-16 items-center justify-between border-b border-slate-100 px-5 ${
            isCollapsed ? 'lg:justify-center lg:px-0' : ''
          }`}
        >
          <Link href={NAV_LINKS[role][0].href} className="flex items-center space-x-2.5" onClick={onClose}>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
              E
            </span>
            <span className={`leading-tight ${hideLabels}`}>
              <span className="block text-sm font-bold text-slate-900">EVOC Labs</span>
              <span className="block text-[10px] font-medium text-slate-400">{PORTAL_NAMES[role]}</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_LINKS[role].map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                title={isCollapsed ? label : undefined}
                className={`flex items-center rounded-lg px-3 py-2 text-sm transition ${
                  isCollapsed ? 'lg:justify-center' : ''
                } ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className={`ml-3 truncate ${hideLabels}`}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse / expand (desktop only) */}
        <div className="border-t border-slate-100 px-3 py-3">
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            <span className={`ml-3 ${hideLabels}`}>Collapse sidebar</span>
          </button>
          <p className={`px-3 pt-1 text-[11px] text-slate-400 lg:hidden`}>Protected by EVOC Anti-Leak</p>
        </div>
      </aside>
    </>
  );
}
