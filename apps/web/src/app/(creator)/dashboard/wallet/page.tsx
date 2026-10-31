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
  ShoppingBag,
  ExternalLink,
  Store,
  History,
  Sparkles,
  Tag
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { refreshPointsBadge } from '@/components/AppShell';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PointsSummary {
  pointsBalance: number;
  lockedPoints: number;
  settledPoints: number;
}

interface LedgerItem {
  id: string;
  pointsDelta: number;
  transactionType: string;
  status: string;
  description?: string;
  referenceId?: string | null;
  createdAt: string;
}

// Curated closed-loop EVOC partner storefronts where points can be redeemed
const PARTNER_STORES = [
  {
    id: 'glow-skincare',
    brandName: 'Glow Skincare D2C',
    category: 'Skincare & Beauty',
    rewardRate: '1 Point = ₹1 Store Credit',
    tagline: 'HydraGlow Peptide Creams, Toners & Serums'
  },
  {
    id: 'urban-grooming',
    brandName: 'Urban Grooming Lab',
    category: 'Men\'s Grooming',
    rewardRate: '1 Point = ₹1 Store Credit',
    tagline: 'Precision Razors, Beard Oils & Shower Essentials'
  },
  {
    id: 'zentech-audio',
    brandName: 'ZenTech Acoustics',
    category: 'Consumer Electronics',
    rewardRate: '1 Point = ₹1 Store Credit',
    tagline: 'Noise-Cancelling Earbuds & Studio Monitors'
  },
  {
    id: 'apex-active',
    brandName: 'Apex Activewear',
    category: 'Fitness & Apparel',
    rewardRate: '1 Point = ₹1 Store Credit',
    tagline: 'Seamless Compression Gear & Training Mats'
  }
];

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
  const { showToast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [displayAlias, setDisplayAlias] = useState<string>('Creator');
  const [points, setPoints] = useState<PointsSummary>({
    pointsBalance: 0,
    lockedPoints: 0,
    settledPoints: 0
  });
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Authenticate & Load Live Points Data (Strict Route Guard)
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

      // 2. Fetch Transaction Ledger
      const ledgerRes = await fetch(`${API_BASE}/api/creators/me/ledger?limit=100`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedger(ledgerData.entries || []);
      }
    } catch (err: any) {
      console.error('Failed to load points data:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Lifetime Earnings: every purchase commission ever credited
  const lifetimeEarnings = ledger
    .filter((item) => item.transactionType === 'PURCHASE_COMMISSION' && item.pointsDelta > 0)
    .reduce((sum, item) => sum + item.pointsDelta, 0);

  // Earliest locked credit determines the next maturation date
  const nextLockedEntry = ledger
    .filter((item) => item.status === 'LOCKED' && item.pointsDelta > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const handleRedeemOnStore = (storeName: string) => {
    if (points.settledPoints < 50) {
      showToast('You need at least 50 settled points to generate a partner store voucher.', 'error');
      return;
    }
    showToast(`Shopping voucher applied! Use ${Math.min(points.settledPoints, 500)} points at checkout on ${storeName}.`);
  };

  return (
    <div className="text-slate-900 pb-12">
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
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Header & Balance Cards */}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Creator Shopping Points</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Every EVOC point is worth ₹1.00 store credit across our curated partner storefronts. Points are earned automatically via ad order attribution.
              </p>
            </div>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Lifetime Earnings */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Lifetime Points Earned</span>
                    <Coins className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">
                    {lifetimeEarnings.toLocaleString()} <span className="text-sm font-semibold text-slate-400">pts</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Total commission credited from attributed UGC ad sales
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                  Current total balance: {points.pointsBalance.toLocaleString()} pts
                </div>
              </div>

              {/* Card 2: Settled Points */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Settled Shopping Balance</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Available Now
                    </span>
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight text-emerald-600">
                    {points.settledPoints.toLocaleString()} <span className="text-sm font-semibold text-slate-400">pts</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    ≈ ₹{points.settledPoints.toLocaleString()} store value ready for brand redemption
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>1 Point = ₹1.00 Store Credit</span>
                  <span className="font-semibold text-indigo-600">EVOC Closed-Loop</span>
                </div>
              </div>

              {/* Card 3: Locked Points */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Locked Points</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      Pending Clearance
                    </span>
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight text-amber-600">
                    {points.lockedPoints.toLocaleString()} <span className="text-sm font-semibold text-slate-400">pts</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Held in 14-day shopper return maturation window
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                  {nextLockedEntry ? (
                    <span className="flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span>
                        Next unlock: <strong className="text-slate-700">+{nextLockedEntry.pointsDelta} pts</strong> on{' '}
                        {getUnlockDate(nextLockedEntry.createdAt).toLocaleDateString()} (
                        {formatUnlockCountdown(nextLockedEntry.createdAt).toLowerCase()})
                      </span>
                    </span>
                  ) : (
                    `Points automatically unlock into settled balance ${MATURATION_DAYS} days after each purchase.`
                  )}
                </div>
              </div>
            </section>

            {/* EVOC Store Partner Brands (Closed-Loop Redemption) */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-indigo-600" />
                    <span>Redeem Shopping Points on Partner Brands</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Apply your points directly for full product redemptions on curated D2C storefronts.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start">
                  Closed-Loop 1:1 Redemption
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PARTNER_STORES.map((store) => (
                  <div
                    key={store.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                          {store.category}
                        </span>
                        <Tag className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{store.brandName}</h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {store.tagline}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="text-[11px] font-semibold text-emerald-700 mb-2">
                        {store.rewardRate}
                      </div>
                      <button
                        onClick={() => handleRedeemOnStore(store.brandName)}
                        className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-indigo-600 transition shadow-sm flex items-center justify-center space-x-1"
                      >
                        <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                        <span>Redeem Points</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Points Transaction Ledger */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Points Activity Ledger</h2>
                  <p className="text-xs text-slate-500">Chronological record of all attributed ad sales and commission points.</p>
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
                    Commissions earned when shoppers purchase products via your UGC video links will appear here.
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    View My Deals
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Order / Reference</th>
                        <th className="px-6 py-3.5">Activity</th>
                        <th className="px-6 py-3.5">Points</th>
                        <th className="px-6 py-3.5 text-right">Clearance Status</th>
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
                            <td className="px-6 py-4 font-mono font-medium text-slate-700">
                              {item.referenceId || 'System Credit'}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {item.description || (isCredit ? 'Attributed UGC Ad Order Commission' : 'Store Redemption')}
                            </td>
                            <td className="px-6 py-4 font-bold">
                              <span className={isCredit ? 'text-emerald-600' : 'text-slate-600'}>
                                {isCredit ? '+' : ''}
                                {item.pointsDelta.toLocaleString()} pts
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span
                                className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                                  isSettled
                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border border-amber-200 bg-amber-50 text-amber-700'
                                }`}
                              >
                                {isSettled ? 'Settled' : 'Locked (14d)'}
                              </span>
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
    </div>
  );
}
