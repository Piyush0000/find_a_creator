'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Coins,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  ShieldCheck,
  ChevronRight,
  X,
  History,
  Inbox
} from 'lucide-react';
import { clearRoleCookie } from '@/lib/session';
import CreatorNav from '@/components/CreatorNav';
import { UPI_VPA_REGEX } from '@evoc/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PointsSummary {
  pointsBalance: number;
  lockedPoints: number;
  settledPoints: number;
}

interface PayoutItem {
  id: string;
  pointsRedeemed: number;
  upiVpa: string;
  status: 'PENDING_UTR' | 'CLEARED' | 'REJECTED';
  utrNumber?: string;
  adminNotes?: string;
  createdAt: string;
}

interface LedgerItem {
  id: string;
  pointsDelta: number;
  transactionType: string;
  status: string;
  description?: string;
  createdAt: string;
}

// Locked points mature into settled balance after the 14-day shopper return window
const MATURATION_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const getUnlockDate = (createdAt: string) => new Date(new Date(createdAt).getTime() + MATURATION_DAYS * DAY_MS);

const formatUnlockCountdown = (createdAt: string) => {
  const daysLeft = Math.ceil((getUnlockDate(createdAt).getTime() - Date.now()) / DAY_MS);
  if (daysLeft <= 0) return 'Unlocking today';
  return `Unlocks in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
};

export default function CreatorWalletPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [displayAlias, setDisplayAlias] = useState<string>('Sai K. — Tech & Lifestyle');
  const [points, setPoints] = useState<PointsSummary>({
    pointsBalance: 0,
    lockedPoints: 0,
    settledPoints: 0
  });
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Payout Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [upiVpa, setUpiVpa] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Authenticate & Load Live Wallet Data (Strict Route Guard)
  const loadWalletData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const activeToken = localStorage.getItem('evoc_token');

      // Strict Auth Guard: If not signed in, redirect to login
      if (!activeToken) {
        router.push('/login?redirect=/dashboard/wallet');
        return;
      }

      setToken(activeToken);

      // 1. Fetch Points Summary
      const pointsRes = await fetch(`${API_BASE}/api/creators/me/points`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (pointsRes.status === 401) {
        localStorage.removeItem('evoc_token');
        router.push('/login?redirect=/dashboard/wallet');
        return;
      }

      if (pointsRes.ok) {
        const pointsData = await pointsRes.json();
        setPoints({
          pointsBalance: pointsData.pointsBalance || 0,
          lockedPoints: pointsData.lockedPoints || 0,
          settledPoints: pointsData.settledPoints || 0
        });
        if (pointsData.displayAlias) {
          setDisplayAlias(pointsData.displayAlias);
        }
      }

      // 2. Fetch Payout History
      const payoutsRes = await fetch(`${API_BASE}/api/payouts/my`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        setPayouts(payoutsData.payouts || []);
      }

      // 3. Fetch Transaction Ledger
      const ledgerRes = await fetch(`${API_BASE}/api/creators/me/ledger`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedger(ledgerData.entries || []);
      }
    } catch (err: any) {
      console.error('Failed to load wallet data:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('evoc_token');
    localStorage.removeItem('evoc_role');
    localStorage.removeItem('evoc_user');
    localStorage.removeItem('evoc_merchant_token');
    localStorage.removeItem('evoc_admin_token');
    clearRoleCookie();
    router.push('/login');
  };

  // Earliest locked credit determines the next maturation date
  const nextLockedEntry = ledger
    .filter((item) => item.status === 'LOCKED' && item.pointsDelta > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // Handle Request Payout Submission
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    const numPoints = Number(pointsToRedeem);

    if (!numPoints || numPoints < 500) {
      setModalError('Minimum payout threshold is 500 points (₹500).');
      return;
    }

    if (numPoints > points.settledPoints) {
      setModalError(`You only have ${points.settledPoints} settled points available to withdraw.`);
      return;
    }

    if (!UPI_VPA_REGEX.test(upiVpa.trim())) {
      setModalError('Please enter a valid UPI ID (e.g. yourname@okhdfcbank).');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/payouts/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          upiVpa: upiVpa.trim(),
          pointsToRedeem: numPoints
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payout request');
      }

      setModalSuccess(`Payout request submitted! EVOC Finance will transfer ₹${numPoints} to your UPI ID and add the bank UTR reference here once it is cleared.`);
      
      // Refresh wallet balances
      setPoints((prev) => ({
        ...prev,
        pointsBalance: data.newBalance !== undefined ? data.newBalance : prev.pointsBalance - numPoints,
        settledPoints: Math.max(0, prev.settledPoints - numPoints)
      }));

      // Add to payout history
      setPayouts((prev) => [
        {
          id: data.payoutRequestId || `temp-${Date.now()}`,
          pointsRedeemed: numPoints,
          upiVpa: upiVpa.trim().replace(/(?<=..).(?=.*@)/g, '*'),
          status: 'PENDING_UTR',
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);

      setTimeout(() => {
        setIsModalOpen(false);
        setUpiVpa('');
        setPointsToRedeem('');
        setModalSuccess(null);
      }, 2000);
    } catch (err: any) {
      setModalError(err.message || 'Payout request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 font-sans antialiased pb-20">
      <CreatorNav
        displayAlias={displayAlias}
        pointsBalance={points.pointsBalance}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {apiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center max-w-lg mx-auto shadow-sm">
            <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Unable to Connect</h3>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">{apiError}</p>
            <button
              onClick={() => loadWalletData()}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Header & Balance Cards */}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Creator Wallet & Payouts</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Every EVOC reward point is worth ₹1.00 INR. Payout requests are reviewed and paid to your UPI ID by EVOC Finance.
              </p>
            </div>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Available to Withdraw */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Available to Withdraw</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Settled
                    </span>
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">
                    ₹{points.settledPoints.toLocaleString()}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {points.settledPoints.toLocaleString()} points ready for UPI payout
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    disabled={points.settledPoints < 500}
                    onClick={() => {
                      setPointsToRedeem(points.settledPoints >= 500 ? points.settledPoints : '');
                      setIsModalOpen(true);
                    }}
                    className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {points.settledPoints >= 500
                      ? 'Withdraw via UPI'
                      : 'Min. 500 pts required to withdraw'}
                  </button>
                </div>
              </div>

              {/* Card 2: Locked Escrow */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Locked in Maturation</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      Pending Clearance
                    </span>
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">
                    ₹{points.lockedPoints.toLocaleString()}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {points.lockedPoints.toLocaleString()} points in shopper return window
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                  {nextLockedEntry ? (
                    <span className="flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span>
                        Next unlock: <strong className="text-slate-700">+{nextLockedEntry.pointsDelta} pts</strong> on{' '}
                        {getUnlockDate(nextLockedEntry.createdAt).toLocaleDateString()} (
                        {formatUnlockCountdown(nextLockedEntry.createdAt).toLowerCase()})
                      </span>
                    </span>
                  ) : (
                    `Points auto-unlock into settled balance ${MATURATION_DAYS} days after each sale.`
                  )}
                </div>
              </div>

              {/* Card 3: Total Lifetime Accumulated */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Total Lifetime Value</span>
                    <Coins className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">
                    ₹{points.pointsBalance.toLocaleString()}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {points.pointsBalance.toLocaleString()} lifetime EVOC points earned
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                  Earned across all active brand ad campaigns.
                </div>
              </div>
            </section>

            {/* Payout Requests History */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Payout Requests History</h2>
                  <p className="text-xs text-slate-500">Track the status of your bank withdrawals and UTR references.</p>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {payouts.length} {payouts.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>

              {payouts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <Banknote className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">No payout requests yet</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    When you withdraw your settled reward balance, your transfer records will show here.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Amount (INR)</th>
                        <th className="px-6 py-3.5">Points Redeemed</th>
                        <th className="px-6 py-3.5">Destination UPI</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5 text-right">Bank UTR Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {payouts.map((p) => {
                        const isCleared = p.status === 'CLEARED';
                        const isPending = p.status === 'PENDING_UTR';

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 text-slate-500">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900">
                              ₹{p.pointsRedeemed.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {p.pointsRedeemed.toLocaleString()} pts
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-600">
                              {p.upiVpa}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                                  isCleared
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : isPending
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {isCleared ? 'Cleared' : isPending ? 'Processing' : 'Rejected'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-500">
                              {isCleared ? (
                                <span className="font-mono">{p.utrNumber}</span>
                              ) : isPending ? (
                                <span className="font-mono">Pending bank confirmation</span>
                              ) : (
                                <span className="text-rose-700">
                                  Points refunded{p.adminNotes ? ` — ${p.adminNotes}` : ''}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Points Transaction Ledger */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Points Activity Ledger</h2>
                  <p className="text-xs text-slate-500">Detailed credit and debit log of all ad campaign commissions.</p>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {ledger.length} {ledger.length === 1 ? 'Entry' : 'Entries'}
                </span>
              </div>

              {ledger.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">No transactions recorded</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Commissions earned when shoppers purchase products via your UGC videos will appear here.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Activity</th>
                        <th className="px-6 py-3.5">Change</th>
                        <th className="px-6 py-3.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {ledger.map((item) => {
                        const isCredit = item.pointsDelta > 0;
                        const isSettled = item.status === 'SETTLED';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 text-slate-500">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900">
                              {item.description || item.transactionType.replace(/_/g, ' ')}
                            </td>
                            <td className="px-6 py-4 font-bold">
                              <span className={isCredit ? 'text-emerald-600' : 'text-slate-900'}>
                                {isCredit ? `+${item.pointsDelta}` : item.pointsDelta} pts
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  isSettled
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {item.status}
                              </span>
                              {item.status === 'LOCKED' && isCredit && (
                                <span className="block mt-1 text-[10px] text-slate-400">
                                  {formatUnlockCountdown(item.createdAt)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Request Payout Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request UPI Payout</h3>
                <p className="text-xs text-slate-500 mt-0.5">Request a withdrawal of your settled earnings to your UPI ID.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="mt-4 space-y-4">
              {/* Settled Balance Notice */}
              <div className="rounded-xl bg-slate-50 p-3 text-xs border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Available Settled Balance:</span>
                <span className="font-bold text-slate-900">
                  {points.settledPoints.toLocaleString()} pts (₹{points.settledPoints.toLocaleString()})
                </span>
              </div>

              {/* UPI VPA Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  UPI ID (Virtual Payment Address)
                </label>
                <input
                  type="text"
                  required
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  placeholder="e.g. yourname@okhdfcbank"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports Google Pay, PhonePe, Paytm, and BHIM UPI IDs.
                </p>
              </div>

              {/* Points to Redeem Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Points to Withdraw (Min. 500)
                </label>
                <input
                  type="number"
                  required
                  min={500}
                  max={points.settledPoints}
                  value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="500"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                />
                {pointsToRedeem !== '' && (
                  <p className="text-[11px] font-medium text-emerald-700 mt-1">
                    Payout Value: ₹{Number(pointsToRedeem).toLocaleString()} INR
                  </p>
                )}
              </div>

              {/* Error / Success Messages */}
              {modalError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || points.settledPoints < 500}
                  className="w-1/2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
