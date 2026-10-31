'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Lock,
  Mail,
  Phone,
  Building2,
  User,
  Sparkles,
  ArrowRight,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { setRoleCookie } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const CATEGORIES = [
  'Beauty',
  'Skincare',
  'Grooming',
  'Fashion & Apparel',
  'Fitness & Health',
  'Food & Beverage',
  'Tech & Electronics',
  'Home & Living',
  'Other'
];

export default function SignupPage() {
  const [role, setRole] = useState<'MERCHANT' | 'CREATOR'>('MERCHANT');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');

  // Merchant specific
  const [brandName, setBrandName] = useState('');

  // Creator specific
  const [displayAlias, setDisplayAlias] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [city, setCity] = useState('');
  const [bioSummary, setBioSummary] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password || !phoneNumber.trim()) {
      setError('Email, phone number, and password are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (role === 'MERCHANT' && !brandName.trim()) {
      setError('Please enter your Brand Name.');
      return;
    }

    if (role === 'CREATOR' && !displayAlias.trim()) {
      setError('Please enter your Creator Display Alias.');
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, any> = {
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
        role
      };

      if (role === 'MERCHANT') {
        payload.brandName = brandName.trim();
      } else {
        payload.displayAlias = displayAlias.trim();
        payload.category = category;
        if (city.trim()) payload.city = city.trim();
        if (bioSummary.trim()) payload.bioSummary = bioSummary.trim();
      }

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please check your inputs.');
      }

      // Store authenticated session
      localStorage.removeItem('evoc_admin_token');
      localStorage.removeItem('evoc_merchant_token');

      localStorage.setItem('evoc_token', data.token);
      localStorage.setItem('evoc_role', data.user.role);
      setRoleCookie(data.user.role);
      localStorage.setItem('evoc_user', JSON.stringify(data.user));

      if (data.user.role === 'MERCHANT') {
        localStorage.setItem('evoc_merchant_token', data.token);
      }

      // Redirect directly to the appropriate dashboard
      window.location.href = role === 'MERCHANT' ? '/creators' : '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-6 antialiased font-sans">
      <div className="w-full max-w-lg space-y-5">
        {/* Brand Header */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg tracking-tight shadow-sm hover:bg-indigo-700 transition"
          >
            E
          </Link>
          <h1 className="mt-3.5 text-2xl font-bold tracking-tight text-slate-900">
            Create your EVOC Account
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Join the premier UGC creator network for high-growth direct-to-consumer brands
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm space-y-5">
          {/* Role Switcher */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Your Account Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('MERCHANT')}
                className={`rounded-xl border p-3 text-left transition flex items-center space-x-3 ${
                  role === 'MERCHANT'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    role === 'MERCHANT' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">D2C Brand / Merchant</div>
                  <div className="text-[10px] text-slate-500">Hire creators & get ads</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('CREATOR')}
                className={`rounded-xl border p-3 text-left transition flex items-center space-x-3 ${
                  role === 'CREATOR'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    role === 'CREATOR' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">UGC Video Creator</div>
                  <div className="text-[10px] text-slate-500">Shoot reels & earn points</div>
                </div>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Role Conditional Fields */}
            {role === 'MERCHANT' ? (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Brand Details
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Glow Skincare"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Creator Profile
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Display Alias / Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={displayAlias}
                        onChange={(e) => setDisplayAlias(e.target.value)}
                        placeholder="e.g. Priya S. — Skincare"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Niche Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City / Location</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai, Bangalore, Delhi"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Short Bio / Content Style</label>
                  <textarea
                    rows={2}
                    value={bioSummary}
                    onChange={(e) => setBioSummary(e.target.value)}
                    placeholder="Specializes in vertical reels, authentic routine unboxing, and problem-solution hooks."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none transition resize-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition flex items-center justify-center space-x-1.5 disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
              {!loading && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100 flex items-center justify-between">
            <span>Already have an account?</span>
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
              Sign in →
            </Link>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
          <span>Protected by EVOC Labs RBAC • Role-based JWT session security</span>
        </div>
      </div>
    </div>
  );
}
