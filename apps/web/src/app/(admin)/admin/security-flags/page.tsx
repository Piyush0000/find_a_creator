'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SecurityFlagItem {
  id: string;
  route: string;
  fields: string[];
  violations: string[];
  userId: string | null;
  role: string | null;
  createdAt: string;
}

export default function SecurityFlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<SecurityFlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load Security Flag Queue (blocked contact leak attempts)
  const loadFlags = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const activeToken = localStorage.getItem('evoc_admin_token') || localStorage.getItem('evoc_token');
      if (!activeToken) {
        router.push('/login?redirect=/admin/security-flags');
        return;
      }

      const res = await fetch(`${API_BASE}/api/admin/security-flags`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('evoc_admin_token');
        router.push('/login?redirect=/admin/security-flags');
        return;
      }
      if (!res.ok) {
        throw new Error(`Security flags failed with status ${res.status}`);
      }

      const data = await res.json();
      setFlags(data.flags || []);
    } catch (err: any) {
      console.error('Failed to load security flags:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  return (
    <div className="text-slate-900 pb-10">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Security Flags</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live audit of contact-sharing attempts blocked by the Anti-Leak filter.
            </p>
          </div>
          <button
            onClick={loadFlags}
            title="Refresh"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {apiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center max-w-lg mx-auto">
            <AlertCircle className="h-6 w-6 text-rose-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900">Unable to Connect</h3>
            <p className="text-xs text-rose-700 mt-1">{apiError}</p>
            <button
              onClick={loadFlags}
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin mb-2" />
            <p className="text-xs font-medium text-slate-500">Loading security flags...</p>
          </div>
        ) : flags.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No blocked attempts</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Briefs and notes that try to share phone numbers, emails, or handles will be logged here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Endpoint</th>
                  <th className="px-5 py-3">Fields</th>
                  <th className="px-5 py-3 text-right">Violations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {flags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(flag.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-800">
                        {flag.role ? flag.role.replace(/_/g, ' ') : 'Unknown'}
                      </span>
                      {flag.userId && (
                        <span className="block font-mono text-[10px] text-slate-400">{flag.userId.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600">{flag.route}</td>
                    <td className="px-5 py-3.5 text-slate-600">{flag.fields.join(', ')}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {flag.violations.map((v) => (
                          <span
                            key={v}
                            className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700"
                          >
                            {v.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
