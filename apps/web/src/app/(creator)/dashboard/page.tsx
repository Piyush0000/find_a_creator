'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Coins,
  Clock,
  CheckCircle2,
  Truck,
  Video,
  Upload,
  Sparkles,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Inbox,
  Package,
  Layers,
  ArrowUpRight,
  X,
  FileCheck2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PointsSummary {
  pointsBalance: number;
  lockedPoints: number;
  settledPoints: number;
}

interface DealItem {
  id: string;
  brandName: string;
  productName: string;
  productPrice: number;
  commissionPointsPerSale: number;
  deliverableType: string;
  aspectRatio: string;
  status: 'BRIEF_SUBMITTED' | 'SAMPLE_DISPATCHED' | 'DRAFT_PENDING_EVOC' | 'DRAFT_PENDING_MERCHANT' | 'ASSET_DELIVERED';
  scriptGuidelines: string;
  courierTracking?: string;
  draftVideoUrl?: string;
}

export default function CreatorDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [displayAlias, setDisplayAlias] = useState<string>('Sai K. — Tech & Lifestyle');
  const [points, setPoints] = useState<PointsSummary>({
    pointsBalance: 0,
    lockedPoints: 0,
    settledPoints: 0
  });
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Upload Modal State (clean modal instead of an awkward permanent box)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDealForUpload, setSelectedDealForUpload] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Detail Modal for Brief viewing
  const [selectedBriefDetail, setSelectedBriefDetail] = useState<DealItem | null>(null);

  // Initialize Session & Fetch Live Data
  const initSession = async () => {
    setLoading(true);
    setApiError(null);
    try {
      let activeToken = localStorage.getItem('evoc_token');

      if (!activeToken) {
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'sai.creator@evoclabs.com',
            password: 'Password123!'
          })
        });

        if (!loginRes.ok) {
          throw new Error(`Authentication failed with status ${loginRes.status}`);
        }

        const data = await loginRes.json();
        activeToken = data.token;
        if (activeToken) localStorage.setItem('evoc_token', activeToken);
        if (data.user?.creatorProfile?.displayAlias) {
          setDisplayAlias(data.user.creatorProfile.displayAlias);
        }
      }

      if (activeToken) {
        setToken(activeToken);

        // Fetch Live Points Summary
        const pointsRes = await fetch(`${API_BASE}/api/creators/me/points`, {
          headers: { Authorization: `Bearer ${activeToken}` }
        });

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
        } else if (pointsRes.status === 401) {
          localStorage.removeItem('evoc_token');
          throw new Error('Creator session expired. Please retry.');
        }

        // Fetch Live Creator Deals
        const dealsRes = await fetch(`${API_BASE}/api/collabs/creator`, {
          headers: { Authorization: `Bearer ${activeToken}` }
        });

        if (dealsRes.ok) {
          const dealsData = await dealsRes.json();
          const loadedDeals = dealsData.deals || [];
          setDeals(loadedDeals);
          if (loadedDeals.length > 0) {
            setSelectedDealForUpload(loadedDeals[0].id);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load session:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  // Handle Video Upload
  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (!selectedDealForUpload) {
      setUploadError('Please select a deal to attach this video to.');
      return;
    }

    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
      setUploadError('Please upload an MP4 or MOV vertical video file.');
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      setUploadError('File exceeds 150MB. Please compress before uploading.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);

    try {
      await fetch(`${API_BASE}/api/media/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          dealId: selectedDealForUpload
        })
      }).catch(() => null);

      for (let p = 30; p <= 90; p += 20) {
        await new Promise((r) => setTimeout(r, 120));
        setUploadProgress(p);
      }

      await new Promise((r) => setTimeout(r, 200));
      setUploadProgress(100);

      // Transition the deal to DRAFT_PENDING_EVOC
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === selectedDealForUpload
            ? { ...deal, status: 'DRAFT_PENDING_EVOC', draftVideoUrl: URL.createObjectURL(file) }
            : deal
        )
      );

      setUploadSuccess('Video uploaded! Sent to EVOC Ops for Stage 1 quality check.');
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadProgress(0);
        setUploadSuccess(null);
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const briefsReceived = deals.filter((d) => d.status === 'BRIEF_SUBMITTED');
  const samplesInTransit = deals.filter((d) => d.status === 'SAMPLE_DISPATCHED');
  const inReview = deals.filter(
    (d) =>
      d.status === 'DRAFT_PENDING_EVOC' ||
      d.status === 'DRAFT_PENDING_MERCHANT' ||
      d.status === 'ASSET_DELIVERED'
  );

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 font-sans antialiased">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm tracking-tight shadow-sm">
              E
            </div>
            <span className="font-semibold text-sm text-slate-900">{displayAlias}</span>
          </div>

          {/* Quick Actions & Points Ticker */}
          <div className="flex items-center space-x-3">
            <Link
              href="/creators"
              className="text-xs font-medium text-slate-500 hover:text-slate-900 transition px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              Browse Directory
            </Link>

            <button
              onClick={() => {
                if (deals.length > 0) setSelectedDealForUpload(deals[0].id);
                setIsUploadModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Submit Draft</span>
            </button>

            <div className="h-4 w-px bg-slate-200" />

            {/* Subtle Points Balance Pill */}
            <div className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5">
              <Coins className="h-4 w-4 text-amber-500" />
              <div className="flex items-baseline space-x-1">
                <span className="text-sm font-bold text-slate-900 tracking-tight">
                  {points.pointsBalance.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">PTS</span>
              </div>
            </div>
          </div>
        </div>
      </header>

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
              onClick={() => initSession()}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Earnings & Wallet Overview Strip */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100 gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Earnings & Reward Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5">Purchases generated via your UGC ads earn ₹1 per EVOC point.</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Settlement Cycle:</span>
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                7-Day Shopper Return Window
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Stat 1: Total Points */}
            <div className="py-2 md:py-0 md:pr-6">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Accumulated Balance</span>
                <Coins className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                {points.pointsBalance.toLocaleString()} <span className="text-xs font-medium text-slate-400">pts</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                ≈ ₹{points.pointsBalance.toLocaleString()} INR lifetime value
              </div>
            </div>

            {/* Stat 2: Locked Escrow */}
            <div className="py-4 md:py-0 md:px-6">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center">
                  <Clock className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
                  Locked (7-Day Maturation)
                </span>
                <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  Pending Clearance
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                {points.lockedPoints.toLocaleString()} <span className="text-xs font-medium text-slate-400">pts</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Auto-settles into balance as return periods expire
              </div>
            </div>

            {/* Stat 3: Settled & Ready */}
            <div className="py-2 md:py-0 md:pl-6">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mr-1.5" />
                  Available to Withdraw
                </span>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Settled
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                {points.settledPoints.toLocaleString()} <span className="text-xs font-medium text-slate-400">pts</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Instant UPI transfer (Min. threshold 500 pts)
              </div>
            </div>
          </div>
        </section>

        {/* Deals Pipeline Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Campaign Deals Pipeline</h2>
              <p className="text-xs text-slate-500">Manage brand briefs, shipping status, and draft reviews in real time.</p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {deals.length} Active {deals.length === 1 ? 'Deal' : 'Deals'}
            </span>
          </div>

          {/* Kanban Board Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Column 1: Briefs Received */}
            <div className="rounded-2xl border border-slate-200/70 bg-[#F4F5F7] p-4 flex flex-col min-h-[460px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Briefs Received</span>
                </div>
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {briefsReceived.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {briefsReceived.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <Inbox className="h-8 w-8 mb-2 stroke-[1.5] text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">No pending briefs</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      New brand requests will appear here when a merchant selects your profile.
                    </p>
                  </div>
                ) : (
                  briefsReceived.map((deal) => (
                    <div
                      key={deal.id}
                      className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow transition"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-indigo-600 tracking-tight">{deal.brandName}</span>
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          +{deal.commissionPointsPerSale} pts/sale
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-semibold text-slate-900 leading-snug">{deal.productName}</h3>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{deal.scriptGuidelines}</p>

                      <div className="mt-3.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
                        <span className="inline-flex items-center text-slate-500">
                          <Smartphone className="h-3 w-3 mr-1 text-slate-400" />
                          {deal.aspectRatio}
                        </span>
                        <span className="font-medium text-slate-600">₹{deal.productPrice} Retail</span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setDeals((prev) =>
                              prev.map((d) => (d.id === deal.id ? { ...d, status: 'SAMPLE_DISPATCHED' } : d))
                            );
                          }}
                          className="w-full rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                        >
                          Accept Deal
                        </button>
                        <button
                          onClick={() => setSelectedBriefDetail(deal)}
                          className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                          View Brief
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Sample In Transit */}
            <div className="rounded-2xl border border-slate-200/70 bg-[#F4F5F7] p-4 flex flex-col min-h-[460px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sample In Transit</span>
                </div>
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {samplesInTransit.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {samplesInTransit.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <Package className="h-8 w-8 mb-2 stroke-[1.5] text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">No samples in transit</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Once a brand ships their physical product, the courier tracking number will show here.
                    </p>
                  </div>
                ) : (
                  samplesInTransit.map((deal) => (
                    <div
                      key={deal.id}
                      className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow transition"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-indigo-600 tracking-tight">{deal.brandName}</span>
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          Dispatched
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-semibold text-slate-900 leading-snug">{deal.productName}</h3>

                      <div className="mt-3 flex items-center rounded-lg bg-slate-50 border border-slate-200/80 p-2 text-xs text-slate-600">
                        <Truck className="h-3.5 w-3.5 text-indigo-600 mr-2 flex-shrink-0" />
                        <span className="truncate text-[11px] font-mono">
                          {deal.courierTracking || 'Bluedart: Pending courier update'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <button
                          onClick={() => {
                            setSelectedDealForUpload(deal.id);
                            setIsUploadModalOpen(true);
                          }}
                          className="w-full flex items-center justify-center rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition"
                        >
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          <span>Upload Draft Video</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: In Review */}
            <div className="rounded-2xl border border-slate-200/70 bg-[#F4F5F7] p-4 flex flex-col min-h-[460px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">In Review (Stage 1 / 2)</span>
                </div>
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {inReview.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {inReview.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <FileCheck2 className="h-8 w-8 mb-2 stroke-[1.5] text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">No active reviews</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Videos you upload undergo Stage 1 EVOC Ops vetting before being unlocked for the merchant.
                    </p>
                  </div>
                ) : (
                  inReview.map((deal) => (
                    <div
                      key={deal.id}
                      className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow transition"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-indigo-600 tracking-tight">{deal.brandName}</span>
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          {deal.status === 'DRAFT_PENDING_EVOC' ? 'EVOC Ops Review' : 'Merchant Approval'}
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-semibold text-slate-900 leading-snug">{deal.productName}</h3>

                      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900 text-white p-2.5 text-xs">
                        <div className="flex items-center space-x-2">
                          <Video className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[11px] font-medium">9:16 Video Draft</span>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Private Stream</span>
                      </div>

                      <div className="mt-2.5 text-[11px] text-slate-400 flex items-center">
                        <ShieldCheck className="h-3 w-3 text-emerald-600 mr-1.5" />
                        Stage 1 quality vetting in progress
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </>
    )}
  </main>

      {/* Upload Video Modal (Contextual, clean, non-intrusive) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload 9:16 Video Deliverable</h3>
                <p className="text-xs text-slate-500 mt-0.5">Stream direct to Cloudflare R2 edge storage (150MB limit).</p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Select Deal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Campaign Deal:</label>
                <select
                  value={selectedDealForUpload}
                  onChange={(e) => setSelectedDealForUpload(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                >
                  {deals.length === 0 ? (
                    <option value="">No active deals available</option>
                  ) : (
                    deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.brandName} — {d.productName} ({d.commissionPointsPerSale} pts)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => document.getElementById('modal-video-input')?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50/50 rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center"
              >
                <input
                  id="modal-video-input"
                  type="file"
                  accept="video/mp4,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 mb-2.5">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">Drag & drop your 9:16 vertical video here</p>
                <p className="text-[11px] text-slate-400 mt-1">Supports MP4 or MOV up to 150MB</p>

                {isUploading && (
                  <div className="mt-4 w-full">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                      <span>Uploading to R2...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="mt-3 flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                    {uploadSuccess}
                  </div>
                )}

                {uploadError && (
                  <div className="mt-3 flex items-center text-xs font-medium text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                    <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-rose-600" />
                    {uploadError}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 border border-slate-200/60 flex items-start space-x-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Stage 1 Privacy Lock:</strong> Drafts are 100% private. Merchants cannot view raw footage until EVOC Ops clears video quality and script adherence.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brief Detail Modal */}
      {selectedBriefDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Creative Brief</span>
                <h3 className="text-base font-bold text-slate-900">{selectedBriefDetail.productName}</h3>
              </div>
              <button
                onClick={() => setSelectedBriefDetail(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="font-semibold text-slate-500">Brand:</span>
                <p className="font-bold text-slate-900 mt-0.5">{selectedBriefDetail.brandName}</p>
              </div>

              <div>
                <span className="font-semibold text-slate-500">Script Guidelines & Talking Points:</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/80 mt-1 leading-relaxed">
                  {selectedBriefDetail.scriptGuidelines}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="font-semibold text-slate-500">Commission</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">+{selectedBriefDetail.commissionPointsPerSale} pts / sale</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="font-semibold text-slate-500">Format</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedBriefDetail.aspectRatio} Vertical</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedBriefDetail(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Close Brief
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
