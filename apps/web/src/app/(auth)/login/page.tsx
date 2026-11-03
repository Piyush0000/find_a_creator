'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Info
} from 'lucide-react';
import { setRoleCookie } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid email or password');
      }

      // Clear any previous role session before storing the new one
      localStorage.removeItem('evoc_admin_token');
      localStorage.removeItem('evoc_merchant_token');

      // Store authenticated session
      localStorage.setItem('evoc_token', data.token);
      localStorage.setItem('evoc_role', data.user.role);
      setRoleCookie(data.user.role);
      localStorage.setItem('evoc_user', JSON.stringify(data.user));

      // Set role-specific tokens
      if (data.user.role === 'SUPER_ADMIN') {
        localStorage.setItem('evoc_admin_token', data.token);
      } else if (data.user.role === 'MERCHANT') {
        localStorage.setItem('evoc_merchant_token', data.token);
      }

      // Determine destination matching the authenticated role
      let destination = redirectParam;
      if (
        !destination ||
        (data.user.role === 'MERCHANT' && destination.startsWith('/dashboard')) ||
        (data.user.role === 'CREATOR' && (destination.startsWith('/collabs') || destination.startsWith('/brief')))
      ) {
        destination =
          data.user.role === 'SUPER_ADMIN'
            ? '/moderation'
            : data.user.role === 'MERCHANT'
            ? '/collabs'
            : '/dashboard';
      }

      // Window navigation guarantees cookies are passed to Next.js middleware
      window.location.href = destination;
    } catch (err: any) {
      setError(err.message || 'Unable to connect to the server. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-5">
      {/* Brand Header */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 text-white font-bold text-lg tracking-tight shadow-md shadow-rose-500/25 hover:scale-105 transition"
        >
          E
        </Link>
        <h1 className="mt-3.5 text-2xl font-bold tracking-tight text-white">
          Sign In to EVOC <span className="text-rose-500">Labs</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Access your Merchant Portal, Creator Workspace, or Ops Console
        </p>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-7 shadow-2xl space-y-5">
        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-750 bg-[#0f172a] py-2.5 pl-9 pr-3 text-xs font-medium text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-200">Password</label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-750 bg-[#0f172a] py-2.5 pl-9 pr-3 text-xs font-medium text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 py-2.5 text-xs font-semibold text-white shadow-md shadow-rose-500/25 hover:from-rose-500 hover:to-rose-600 transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            {!loading && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-800/80 flex items-center justify-between">
          <span>Don&apos;t have an account?</span>
          <Link href="/signup" className="font-semibold text-rose-400 hover:text-rose-300 hover:underline">
            Create account →
          </Link>
        </div>

        {/* Collapsible Seeded Accounts Hint */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowHint((prev) => !prev)}
            className="w-full text-center text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 transition"
          >
            <Info className="h-3 w-3" />
            <span>{showHint ? 'Hide test credentials' : 'View seeded test credentials'}</span>
          </button>

          {showHint && (
            <div className="mt-2.5 p-3 rounded-xl bg-[#070b16] border border-slate-800 text-[11px] text-slate-300 space-y-1 animate-fade-in font-mono">
              <div><strong className="text-rose-400 font-sans">Merchant:</strong> founder@glowskincare.com</div>
              <div><strong className="text-rose-400 font-sans">Creator:</strong> rohit.creator@evoc.internal</div>
              <div><strong className="text-rose-400 font-sans">Admin:</strong> admin@evoclabs.com</div>
              <div className="text-slate-500 pt-0.5 text-[10px]">Password: Password123!</div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-rose-500" />
        <span>Protected by EVOC Labs RBAC • Role-based JWT session security</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#070b16] text-slate-100 flex flex-col justify-center items-center p-6 antialiased font-sans">
      <Suspense fallback={<div className="text-xs text-slate-400">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
