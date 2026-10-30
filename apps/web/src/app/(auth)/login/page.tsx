'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  User,
  ShieldCheck,
  Building2,
  Sparkles
} from 'lucide-react';
import { setRoleCookie } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TEST_ACCOUNTS = [
  {
    role: 'CREATOR',
    label: 'Creator',
    name: 'Rohit S.',
    email: 'rohit.creator@evoc.internal',
    password: 'Password123!',
    redirect: '/dashboard'
  },
  {
    role: 'MERCHANT',
    label: 'Merchant',
    name: 'Glow Skincare',
    email: 'founder@glowskincare.com',
    password: 'Password123!',
    redirect: '/creators'
  },
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    name: 'EVOC Ops',
    email: 'admin@evoclabs.com',
    password: 'Password123!',
    redirect: '/moderation'
  }
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Also set role-specific tokens for seamless routing
      if (data.user.role === 'SUPER_ADMIN') {
        localStorage.setItem('evoc_admin_token', data.token);
      } else if (data.user.role === 'MERCHANT') {
        localStorage.setItem('evoc_merchant_token', data.token);
      }

      // Determine destination
      if (redirectParam) {
        router.push(redirectParam);
      } else if (data.user.role === 'SUPER_ADMIN') {
        router.push('/moderation');
      } else if (data.user.role === 'MERCHANT') {
        router.push('/creators');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectPersona = (acc: typeof TEST_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-lg tracking-tight shadow-md hover:bg-slate-800 transition"
        >
          E
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Sign in to EVOC Labs</h1>
        <p className="mt-1.5 text-xs text-slate-500">
          Access your Creator Workspace, Merchant Portal, or Admin Console
        </p>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
        {/* Quick Fill Test Personas */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Quick Persona Login (Testing)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TEST_ACCOUNTS.map((acc) => {
              const isActive = email === acc.email;
              return (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => selectPersona(acc)}
                  className={`rounded-xl border p-2.5 text-center transition flex flex-col items-center justify-center ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-[11px] font-bold block">{acc.label}</span>
                  <span className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {acc.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[10px] uppercase tracking-wider text-slate-400 absolute">
            or enter credentials
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            {!loading && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </form>
      </div>

      <div className="text-center text-[11px] text-slate-400">
        Protected by EVOC Labs RBAC • Role-based JWT session security
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFD] flex flex-col justify-center items-center p-6 antialiased font-sans">
      <Suspense fallback={<div className="text-xs text-slate-400">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
