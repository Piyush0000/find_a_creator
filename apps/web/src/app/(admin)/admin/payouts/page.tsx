'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, AlertCircle, RefreshCw, Inbox, X } from 'lucide-react';
import { useToast } from '@/components/Toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type PayoutStatus = 'PENDING_UTR' | 'CLEARED' | 'REJECTED';

interface PayoutRequestItem {
  id: string;
  pointsRedeemed: number;
  upiVpa: string;
  status: PayoutStatus;
  utrNumber?: string;
  adminNotes?: string;
  createdAt: string;
  creator?: {
    displayAlias: string;
    category: string;
    pointsBalance: number;
  };
}

const STATUS_TABS: Array<{ status: PayoutStatus; label: string }> = [
  { status: 'PENDING_UTR', label: 'Pending' },
  { status: 'CLEARED', label: 'Cleared' },
  { status: 'REJECTED', label: 'Rejected' }
];

const STATUS_BADGES: Record<PayoutStatus, { label: string; className: string }> = {
  PENDING_UTR: { label: 'Pending UTR', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  CLEARED: { label: 'Cleared', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-50 text-rose-700 border-rose-200' }
};

export default function AdminPayoutsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PayoutStatus>('PENDING_UTR');
  const [payouts, setPayouts] = useState<PayoutRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Clear / Reject Action Modal
  const [actionPayout, setActionPayout] = useState<PayoutRequestItem | null>(null);
  const [actionMode, setActionMode] = useState<'clear' | 'reject'>('clear');
  const [utrNumberInput, setUtrNumberInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Finance Queue (Strict Route Guard)
  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const activeToken = localStorage.getItem('evoc_admin_token') || localStorage.getItem('evoc_token');
      if (!activeToken) {
        router.push('/login?redirect=/admin/payouts');
        return;
      }
      setToken(activeToken);

      const res = await fetch(`${API_BASE}/api/admin/payouts?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('evoc_admin_token');
        router.push('/login?redirect=/admin/payouts');
        return;
      }
      if (!res.ok) {
        throw new Error(`Payout queue failed with status ${res.status}`);
      }

      const data = await res.json();
      setPayouts(data.payouts || []);
    } catch (err: any) {
      console.error('Failed to load payouts:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router, statusFilter]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const openAction = (payout: PayoutRequestItem, mode: 'clear' | 'reject') => {
    setActionPayout(payout);
    setActionMode(mode);
    setUtrNumberInput('');
    setNotesInput('');
    setActionError(null);
  };

  // Clear with bank UTR, or reject and auto-refund points to the creator
  const submitAction = async () => {
    if (!actionPayout) return;

    if (actionMode === 'clear' && !utrNumberInput.trim()) {
      setActionError('Enter the bank UTR reference number.');
      return;
    }
    if (actionMode === 'reject' && notesInput.trim().length < 5) {
      setActionError('Enter a rejection reason (at least 5 characters).');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/payouts/${actionPayout.id}/${actionMode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(
          actionMode === 'clear'
            ? { utrNumber: utrNumberInput.trim(), adminNotes: notesInput.trim() || 'Settled via Corporate Banking' }
            : { adminNotes: notesInput.trim() }
        )
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${actionMode} payout`);
      }

      // Keep the row visible with its new badge until the next refresh
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === actionPayout.id
            ? {
                ...p,
                status: actionMode === 'clear' ? 'CLEARED' : 'REJECTED',
                utrNumber: actionMode === 'clear' ? utrNumberInput.trim() : p.utrNumber,
                adminNotes: notesInput.trim() || p.adminNotes
              }
            : p
        )
      );
      setActionPayout(null);
      showToast(
        actionMode === 'clear'
          ? `Payout cleared with UTR ${utrNumberInput.trim()}.`
          : 'Payout rejected. Points refunded to the creator.'
      );
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="text-slate-900 pb-10">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Payout Clearance</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Transfer creator withdrawals by UPI, then record the bank UTR reference to clear them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {STATUS_TABS.map(({ status, label }) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    statusFilter === status ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={loadPayouts}
              title="Refresh"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {apiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center max-w-lg mx-auto">
            <AlertCircle className="h-6 w-6 text-rose-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900">Unable to Connect</h3>
            <p className="text-xs text-rose-700 mt-1">{apiError}</p>
            <button
              onClick={loadPayouts}
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin mb-2" />
            <p className="text-xs font-medium text-slate-500">Loading payout queue...</p>
          </div>
        ) : payouts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">
              No {STATUS_TABS.find((t) => t.status === statusFilter)?.label.toLowerCase()} payouts
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Creator withdrawal requests will appear here.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Creator Alias</th>
                  <th className="px-5 py-3">Points Redeemed (₹ Value)</th>
                  <th className="px-5 py-3">Masked UPI VPA</th>
                  <th className="px-5 py-3">Submission Timestamp</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payouts.map((payout) => {
                  const badge = STATUS_BADGES[payout.status];
                  return (
                    <tr key={payout.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {payout.creator?.displayAlias || 'Creator'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900">{payout.pointsRedeemed.toLocaleString()} pts</span>
                        <span className="ml-1.5 text-emerald-700 font-semibold">
                          (₹{payout.pointsRedeemed.toLocaleString()})
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">{payout.upiVpa}</td>
                      <td className="px-5 py-3.5 text-slate-500">{new Date(payout.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right">
                        {payout.status === 'PENDING_UTR' ? (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => openAction(payout, 'clear')}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                            >
                              Clear with UTR
                            </button>
                            <button
                              onClick={() => openAction(payout, 'reject')}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                            >
                              Reject &amp; Refund
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${badge.className}`}>
                              {badge.label}
                            </span>
                            {payout.status === 'CLEARED' && payout.utrNumber && (
                              <span className="font-mono text-[10px] text-slate-500">{payout.utrNumber}</span>
                            )}
                            {payout.status === 'REJECTED' && payout.adminNotes && (
                              <span className="text-[10px] text-slate-500 max-w-[200px] truncate">{payout.adminNotes}</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Clear / Reject Modal */}
      {actionPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Banknote className={`h-4 w-4 ${actionMode === 'clear' ? 'text-emerald-600' : 'text-rose-600'}`} />
                <h3 className="text-sm font-bold text-slate-900">
                  {actionMode === 'clear' ? 'Record Bank Settlement' : 'Reject Payout'}
                </h3>
              </div>
              <button
                onClick={() => setActionPayout(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              {actionPayout.creator?.displayAlias} • <strong className="text-slate-900">₹{actionPayout.pointsRedeemed}</strong> to{' '}
              <span className="font-mono">{actionPayout.upiVpa}</span>
            </div>

            <div className="mt-4 space-y-3">
              {actionMode === 'clear' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank UTR Reference Number</label>
                  <input
                    type="text"
                    value={utrNumberInput}
                    onChange={(e) => setUtrNumberInput(e.target.value)}
                    placeholder="e.g. HDFC2026102912345"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {actionMode === 'clear' ? 'Internal notes (optional)' : 'Reason for rejection'}
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder={actionMode === 'clear' ? 'e.g. HDFC NetBanking Corp' : 'e.g. UPI ID could not be verified'}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
                {actionMode === 'reject' && (
                  <p className="mt-1 text-[11px] text-slate-400">The points will be refunded to the creator&apos;s balance.</p>
                )}
              </div>

              {actionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                  {actionError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setActionPayout(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={submitAction}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold text-white transition disabled:opacity-50 ${
                    actionMode === 'clear' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : actionMode === 'clear' ? 'Confirm Settlement' : 'Reject & Refund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
