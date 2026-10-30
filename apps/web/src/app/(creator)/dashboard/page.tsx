'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { useToast } from '@/components/Toast';

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
  status:
    | 'BRIEF_SUBMITTED'
    | 'CREATOR_ACCEPTED'
    | 'SAMPLE_DISPATCHED'
    | 'DRAFT_PENDING_EVOC'
    | 'DRAFT_REVISION_REQUESTED'
    | 'EVOC_APPROVED'
    | 'DRAFT_PENDING_MERCHANT'
    | 'ASSET_DELIVERED'
    | 'CAMPAIGN_ACTIVE'
    | 'COMPLETED'
    | 'DECLINED';
  scriptGuidelines: string;
  courierTracking?: string;
  revisionNotes?: string;
  draftVideoUrl?: string;
}

// Cards shown per column before "Show more"
const COLUMN_PREVIEW_COUNT = 4;

interface KanbanColumnProps {
  title: string;
  dotClass: string;
  items: DealItem[];
  emptyText: string;
  renderCard: (deal: DealItem) => React.ReactNode;
}

// One Kanban column that grows with its cards (no inner scrollbar)
function KanbanColumn({ title, dotClass, items, emptyText, renderCard }: KanbanColumnProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = isExpanded ? items : items.slice(0, COLUMN_PREVIEW_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100/60 p-3">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</span>
        </div>
        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleItems.map(renderCard)}
          {items.length > COLUMN_PREVIEW_COUNT && (
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="w-full rounded-lg py-1.5 text-xs font-semibold text-indigo-600 hover:bg-white transition"
            >
              {isExpanded ? 'Show less' : `Show ${hiddenCount} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreatorDashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
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
  // Revision feedback boxes the creator has expanded
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<string[]>([]);

  // Initialize Session & Fetch Live Data (Strict Route Guard)
  const initSession = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const activeToken = localStorage.getItem('evoc_token');

      // Strict Auth Guard: If no token exists, redirect to login
      if (!activeToken) {
        router.push('/login?redirect=/dashboard');
        return;
      }

      setToken(activeToken);

      // Fetch Live Points Summary
      const pointsRes = await fetch(`${API_BASE}/api/creators/me/points`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (pointsRes.status === 401) {
        localStorage.removeItem('evoc_token');
        router.push('/login?redirect=/dashboard');
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
    } catch (err: any) {
      console.error('Failed to load session:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDeal = async (dealId: string) => {
    try {
      const activeToken = token || localStorage.getItem('evoc_token');
      const res = await fetch(`${API_BASE}/api/collabs/${dealId}/accept`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        }
      });
      if (res.ok) {
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, status: 'CREATOR_ACCEPTED' } : d))
        );
        showToast('Deal accepted! It moved to Sample In Transit.');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to accept deal', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error while accepting deal', 'error');
    }
  };

  const handleDeclineDeal = async (dealId: string) => {
    if (!confirm('Are you sure you want to decline this collaboration?')) return;
    try {
      const activeToken = token || localStorage.getItem('evoc_token');
      const res = await fetch(`${API_BASE}/api/collabs/${dealId}/decline`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        }
      });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
        showToast('Brief declined.', 'info');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to decline deal', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error while declining deal', 'error');
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  // PUT the raw file to the presigned R2 URL with real progress reporting
  const uploadFileToR2 = (uploadUrl: string, file: File, onProgress: (percent: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Video upload to storage failed (status ${xhr.status}). Please try again.`));
      xhr.onerror = () => reject(new Error('Network error while uploading the video. Please try again.'));
      xhr.send(file);
    });

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
    setUploadProgress(5);

    try {
      const activeToken = token || localStorage.getItem('evoc_token');

      // 1. Request a 15-minute presigned R2 PUT URL
      const presignRes = await fetch(`${API_BASE}/api/media/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          folder: 'drafts'
        })
      });

      const presignData = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok || !presignData.uploadUrl || !presignData.publicUrl) {
        throw new Error(presignData.error || 'Could not get an upload URL. Please try again.');
      }

      setUploadProgress(10);

      // 2. Stream the file directly from the browser to Cloudflare R2
      // Local dev without R2 credentials returns a mock URL, so the file transfer is skipped
      const isMockUpload = String(presignData.uploadUrl).includes('mock-presigned=true');
      if (isMockUpload) {
        console.warn('[Upload] R2 is in mock mode (no R2 credentials configured). Skipping file transfer.');
      } else {
        await uploadFileToR2(presignData.uploadUrl, file, (percent) =>
          setUploadProgress(10 + Math.round(percent * 0.8))
        );
      }

      setUploadProgress(90);

      const draftVideoUrl: string = presignData.publicUrl;

      // Submit Draft to Backend API to permanently transition state in PostgreSQL
      const draftRes = await fetch(`${API_BASE}/api/collabs/${selectedDealForUpload}/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({ draftVideoUrl })
      });

      if (!draftRes.ok) {
        const errJson = await draftRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to submit draft to server');
      }

      await new Promise((r) => setTimeout(r, 150));
      setUploadProgress(100);

      // Transition the deal to DRAFT_PENDING_EVOC in local state
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === selectedDealForUpload
            ? { ...deal, status: 'DRAFT_PENDING_EVOC', draftVideoUrl }
            : deal
        )
      );

      setUploadSuccess('Video uploaded! Sent to EVOC Ops for Stage 1 quality check.');
      showToast('Draft uploaded and sent to EVOC Ops for review.');
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

  const briefsReceived = deals.filter((d) => d.status === 'BRIEF_SUBMITTED' || d.status === 'EVOC_APPROVED');
  const samplesInTransit = deals.filter(
    (d) =>
      d.status === 'SAMPLE_DISPATCHED' ||
      d.status === 'CREATOR_ACCEPTED' ||
      d.status === 'DRAFT_REVISION_REQUESTED'
  );
  const inReview = deals.filter(
    (d) => d.status === 'DRAFT_PENDING_EVOC' || d.status === 'DRAFT_PENDING_MERCHANT'
  );
  // Finished deals move out of the active board so columns don't grow forever
  const delivered = deals.filter(
    (d) => d.status === 'ASSET_DELIVERED' || d.status === 'CAMPAIGN_ACTIVE' || d.status === 'COMPLETED'
  );
  const activeDealsCount = briefsReceived.length + samplesInTransit.length + inReview.length;

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
              onClick={() => initSession()}
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
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
                14-Day Shopper Return Window
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
                  Locked (14-Day Maturation)
                </span>
                <span className="text-[11px] font-medium text-amber-600 border border-amber-200 bg-amber-50 px-2 py-0.5 rounded-full">
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
                <span className="text-[11px] font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Settled
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                {points.settledPoints.toLocaleString()} <span className="text-xs font-medium text-slate-400">pts</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Request a UPI payout (Min. threshold 500 pts)
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
              {activeDealsCount} Active {activeDealsCount === 1 ? 'Deal' : 'Deals'}
            </span>
          </div>

          {/* Kanban Board Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {/* Column 1: Briefs Received */}
            <KanbanColumn
              title="Briefs Received"
              dotClass="bg-blue-500"
              items={briefsReceived}
              emptyText="No new briefs yet"
              renderCard={(deal) => (
                <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-indigo-600">{deal.brandName}</span>
                    <span className="flex-shrink-0 whitespace-nowrap rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                      +{deal.commissionPointsPerSale} pts/sale
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-slate-900 leading-snug">{deal.productName}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{deal.scriptGuidelines}</p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="inline-flex items-center">
                      <Smartphone className="h-3 w-3 mr-1 text-slate-400" />
                      {deal.aspectRatio}
                    </span>
                    <span className="font-medium text-slate-600">₹{deal.productPrice} retail</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleAcceptDeal(deal.id)}
                      className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setSelectedBriefDetail(deal)}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      View Brief
                    </button>
                    <button
                      onClick={() => handleDeclineDeal(deal.id)}
                      title="Decline Brief"
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            />

            {/* Column 2: Sample In Transit */}
            <KanbanColumn
              title="Sample In Transit"
              dotClass="bg-amber-500"
              items={samplesInTransit}
              emptyText="No samples on the way"
              renderCard={(deal) => {
                const isRevision = deal.status === 'DRAFT_REVISION_REQUESTED';
                const isFeedbackOpen = expandedFeedbackIds.includes(deal.id);
                return (
                  <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-semibold text-indigo-600">{deal.brandName}</span>
                      <span
                        className={`flex-shrink-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                          isRevision
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : deal.status === 'CREATOR_ACCEPTED'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {isRevision ? 'Revision Needed' : deal.status === 'CREATOR_ACCEPTED' ? 'Accepted' : 'In Transit'}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold text-slate-900 leading-snug">{deal.productName}</h3>

                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500" title={deal.courierTracking}>
                      <Truck className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">
                        {deal.courierTracking ||
                          (deal.status === 'CREATOR_ACCEPTED' ? 'Awaiting sample dispatch' : 'Tracking details not added')}
                      </span>
                    </div>

                    {isRevision && deal.revisionNotes && (
                      <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-800 leading-relaxed">
                        <p className={isFeedbackOpen ? '' : 'line-clamp-2'}>
                          <span className="font-semibold">EVOC Ops: </span>
                          {deal.revisionNotes}
                        </p>
                        <button
                          onClick={() =>
                            setExpandedFeedbackIds((prev) =>
                              isFeedbackOpen ? prev.filter((id) => id !== deal.id) : [...prev, deal.id]
                            )
                          }
                          className="mt-0.5 font-semibold text-rose-700 hover:underline"
                        >
                          {isFeedbackOpen ? 'Show less' : 'Read more'}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedDealForUpload(deal.id);
                        setIsUploadModalOpen(true);
                      }}
                      className="mt-3 w-full flex items-center justify-center rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {isRevision ? 'Upload New Draft' : 'Upload Draft Video'}
                    </button>
                  </div>
                );
              }}
            />

            {/* Column 3: In Review */}
            <KanbanColumn
              title="In Review"
              dotClass="bg-emerald-500"
              items={inReview}
              emptyText="No drafts under review"
              renderCard={(deal) => (
                <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-indigo-600">{deal.brandName}</span>
                    <span className="flex-shrink-0 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      {deal.status === 'DRAFT_PENDING_EVOC' ? 'EVOC Ops Review' : 'Brand Review'}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-slate-900 leading-snug">{deal.productName}</h3>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Video className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span>9:16 draft · private stream</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                    <span>
                      {deal.status === 'DRAFT_PENDING_EVOC'
                        ? 'Stage 1 quality check in progress'
                        : 'Cleared by EVOC Ops — awaiting brand approval'}
                    </span>
                  </div>
                </div>
              )}
            />

            {/* Column 4: Delivered */}
            <KanbanColumn
              title="Delivered"
              dotClass="bg-slate-400"
              items={delivered}
              emptyText="No delivered ads yet"
              renderCard={(deal) => (
                <div
                  key={deal.id}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{deal.productName}</span>
                    <span className="flex-shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {deal.status === 'CAMPAIGN_ACTIVE' ? 'Live' : deal.status === 'COMPLETED' ? 'Completed' : 'Delivered'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {deal.brandName} · +{deal.commissionPointsPerSale} pts per sale
                  </p>
                </div>
              )}
            />
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
                        className="h-full bg-indigo-600 animate-pulse transition-all duration-150"
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
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
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
