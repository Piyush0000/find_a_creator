'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Coins,
  Clock,
  CheckCircle2,
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
  RefreshCw,
  FileText,
  Copy,
  Check,
  Eye,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { clearSession } from '@/lib/session';

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
    | 'DRAFT_PENDING_EVOC'
    | 'DRAFT_REVISION_REQUESTED'
    | 'EVOC_APPROVED'
    | 'DRAFT_PENDING_MERCHANT'
    | 'ASSET_DELIVERED'
    | 'CAMPAIGN_ACTIVE'
    | 'COMPLETED'
    | 'DECLINED';
  scriptGuidelines: string;
  videoHooks?: string | null;
  evocReviewNotes?: string | null;
  merchantReviewNotes?: string | null;
  approvedVideoUrl?: string | null;
  utmTrackingSlug?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  const [copiedScript, setCopiedScript] = useState(false);
  // Revision feedback boxes the creator has expanded
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<string[]>([]);
  // Pipeline tab filter so user can choose which deals section they want to see
  const [pipelineTab, setPipelineTab] = useState<'ALL' | 'BRIEFS' | 'PRODUCTION' | 'REVIEW' | 'DELIVERED'>('ALL');

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

      if (pointsRes.status === 401 || pointsRes.status === 403 || pointsRes.status === 404) {
        clearSession();
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
        showToast('Deal accepted! Ready for draft video submission.');
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

  // Direct streaming upload to backend API (which streams directly to Cloudflare R2 bucket)
  // This completely eliminates browser CORS preflight blocks while preserving Cloudflare R2 storage
  const uploadVideoDirect = (
    file: File,
    activeToken: string,
    onProgress: (percent: number) => void
  ) =>
    new Promise<{ publicUrl: string; key: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/media/upload`);
      if (activeToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${activeToken}`);
      }
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
      xhr.setRequestHeader('x-folder', 'drafts');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          onProgress(Math.min(95, Math.round(percent)));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.publicUrl) {
              resolve(data);
            } else {
              reject(new Error(data.error || 'Failed to retrieve uploaded video URL.'));
            }
          } catch {
            reject(new Error('Invalid response from storage upload.'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error while uploading the video. Please verify connection and try again.'));
      };

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
      const activeToken = token || localStorage.getItem('evoc_token') || '';

      const uploadResult = await uploadVideoDirect(file, activeToken, (percent) => {
        setUploadProgress(Math.max(5, percent));
      });

      setUploadProgress(95);

      const draftVideoUrl: string = uploadResult.publicUrl;

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
  const inProduction = deals.filter(
    (d) =>
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
  const activeDealsCount = briefsReceived.length + inProduction.length + inReview.length;

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
                  Settled Shopping Points
                </span>
                <span className="text-[11px] font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Settled
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                {points.settledPoints.toLocaleString()} <span className="text-xs font-medium text-slate-400">pts</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Redeem on partner stores (1 Pt = ₹1 value)
              </div>
            </div>
          </div>
        </section>

        {/* Deals Pipeline Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Campaign Deals Pipeline</h2>
              <p className="text-xs text-slate-500">Filter and manage brand briefs, video production, and submissions.</p>
            </div>

            {/* User Selectable Filter Tabs */}
            <div className="inline-flex p-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto max-w-full">
              {[
                { id: 'ALL', label: 'All Deals', count: deals.length },
                { id: 'BRIEFS', label: 'Briefs Received', count: briefsReceived.length, dot: 'bg-blue-500' },
                { id: 'PRODUCTION', label: 'In Production', count: inProduction.length, dot: 'bg-amber-500' },
                { id: 'REVIEW', label: 'In Review', count: inReview.length, dot: 'bg-emerald-500' },
                { id: 'DELIVERED', label: 'Delivered', count: delivered.length, dot: 'bg-slate-400' }
              ].map((tab) => {
                const isActive = pipelineTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setPipelineTab(tab.id as any)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {tab.dot && <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : tab.dot}`} />}
                    <span>{tab.label}</span>
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabbed Content View (Shows what the user wants to see) */}
          <div className="space-y-4">
            {/* 1. Briefs Received View */}
            {(pipelineTab === 'BRIEFS' || pipelineTab === 'ALL') && briefsReceived.length > 0 && (
              <div className="space-y-3">
                {pipelineTab === 'ALL' && (
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Briefs Received ({briefsReceived.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {briefsReceived.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedBriefDetail(deal)}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-400 animate-fade-in flex flex-col justify-between cursor-pointer group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-indigo-600">{deal.brandName}</span>
                          <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            +{deal.commissionPointsPerSale} pts/sale
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">{deal.productName}</h3>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{deal.scriptGuidelines}</p>
                        
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                          <span className="inline-flex items-center font-medium text-slate-600">
                            <Smartphone className="h-3.5 w-3.5 mr-1 text-slate-400" />
                            {deal.aspectRatio}
                          </span>
                          <span className="font-semibold text-slate-700">₹{deal.productPrice} retail</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptDeal(deal.id);
                          }}
                          className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                        >
                          Accept
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBriefDetail(deal);
                          }}
                          className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-1"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          View Script
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineDeal(deal.id);
                          }}
                          title="Decline Brief"
                          className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. In Production View */}
            {(pipelineTab === 'PRODUCTION' || pipelineTab === 'ALL') && inProduction.length > 0 && (
              <div className="space-y-3">
                {pipelineTab === 'ALL' && (
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>In Production & Uploads ({inProduction.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inProduction.map((deal) => {
                    const isRevision = deal.status === 'DRAFT_REVISION_REQUESTED';
                    const isFeedbackOpen = expandedFeedbackIds.includes(deal.id);
                    return (
                      <div
                        key={deal.id}
                        onClick={() => setSelectedBriefDetail(deal)}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-400 animate-fade-in flex flex-col justify-between cursor-pointer group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-indigo-600">{deal.brandName}</span>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                                isRevision
                                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {isRevision ? 'Revision Needed' : 'Ready to Shoot'}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">{deal.productName}</h3>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <span>{deal.deliverableType} • {deal.aspectRatio}</span>
                            <span className="font-semibold text-indigo-600">+{deal.commissionPointsPerSale} pts/sale</span>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                            <span className="inline-flex items-center text-indigo-600 font-semibold group-hover:underline">
                              <FileText className="h-3 w-3 mr-1" /> View Script & Brief
                            </span>
                            <span className="text-slate-400 text-[10px]">Click to inspect</span>
                          </div>

                          {isRevision && (deal.evocReviewNotes || deal.revisionNotes) && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 leading-relaxed"
                            >
                              <p className={isFeedbackOpen ? '' : 'line-clamp-2'}>
                                <span className="font-semibold">EVOC Ops Notes: </span>
                                {deal.evocReviewNotes || deal.revisionNotes}
                              </p>
                              <button
                                onClick={() =>
                                  setExpandedFeedbackIds((prev) =>
                                    isFeedbackOpen ? prev.filter((id) => id !== deal.id) : [...prev, deal.id]
                                  )
                                }
                                className="mt-1 font-semibold text-rose-700 hover:underline text-[11px]"
                              >
                                {isFeedbackOpen ? 'Show less' : 'Read more'}
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDealForUpload(deal.id);
                            setIsUploadModalOpen(true);
                          }}
                          className="mt-4 w-full flex items-center justify-center rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                        >
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          {isRevision ? 'Upload New Draft Video' : 'Upload Draft Video'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. In Review View */}
            {(pipelineTab === 'REVIEW' || pipelineTab === 'ALL') && inReview.length > 0 && (
              <div className="space-y-3">
                {pipelineTab === 'ALL' && (
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>In Review ({inReview.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inReview.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedBriefDetail(deal)}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-400 animate-fade-in space-y-2.5 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-indigo-600">{deal.brandName}</span>
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {deal.status === 'DRAFT_PENDING_EVOC' ? 'EVOC Ops Quality Review' : 'Brand Final Review'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">{deal.productName}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Video className="h-3.5 w-3.5 text-slate-400" />
                        <span>9:16 vertical draft · private R2 stream</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-emerald-700 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                          <span className="text-[11px]">
                            {deal.status === 'DRAFT_PENDING_EVOC'
                              ? 'Stage 1 quality check'
                              : 'Awaiting brand approval'}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-indigo-600 group-hover:underline flex items-center">
                          <FileText className="h-3 w-3 mr-0.5" /> View Script
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Delivered View */}
            {(pipelineTab === 'DELIVERED' || pipelineTab === 'ALL') && delivered.length > 0 && (
              <div className="space-y-3">
                {pipelineTab === 'ALL' && (
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Delivered & Active Campaigns ({delivered.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {delivered.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedBriefDetail(deal)}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-400 animate-fade-in space-y-2 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">{deal.productName}</span>
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {deal.status === 'CAMPAIGN_ACTIVE' ? 'Live Campaign' : 'Completed'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {deal.brandName} · <span className="font-semibold text-indigo-600">+{deal.commissionPointsPerSale} pts</span> per sale
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span className="font-semibold text-indigo-600 group-hover:underline flex items-center">
                          <FileText className="h-3 w-3 mr-1" /> View Script & Assets
                        </span>
                        <span className="text-emerald-600 font-medium text-[10px]">Delivered</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clean, spacious empty states when a category has 0 items */}
            {((pipelineTab === 'ALL' && deals.length === 0) ||
              (pipelineTab === 'BRIEFS' && briefsReceived.length === 0) ||
              (pipelineTab === 'PRODUCTION' && inProduction.length === 0) ||
              (pipelineTab === 'REVIEW' && inReview.length === 0) ||
              (pipelineTab === 'DELIVERED' && delivered.length === 0)) && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-3">
                  <Inbox className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {pipelineTab === 'BRIEFS'
                    ? 'No new briefs received'
                    : pipelineTab === 'PRODUCTION'
                    ? 'No deals in production'
                    : pipelineTab === 'REVIEW'
                    ? 'No drafts under review'
                    : pipelineTab === 'DELIVERED'
                    ? 'No delivered campaigns yet'
                    : 'No campaign deals yet'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  {pipelineTab === 'BRIEFS'
                    ? 'When D2C brands hire you for UGC ads, incoming collaboration briefs will appear here.'
                    : pipelineTab === 'PRODUCTION'
                    ? 'Accepted briefs ready for your vertical UGC video shooting and draft uploads appear here.'
                    : pipelineTab === 'REVIEW'
                    ? 'Video drafts undergoing EVOC Ops quality review or brand approval appear here.'
                    : pipelineTab === 'DELIVERED'
                    ? 'Approved and active campaigns generating sales points will appear here.'
                    : 'Collaboration requests sent by brands will appear right here in your pipeline.'}
                </p>
              </div>
            )}
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
                      <span>Streaming to Cloudflare R2...</span>
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

      {/* Complete Brief & Detailed Script Modal */}
      {selectedBriefDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 relative my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                    {selectedBriefDetail.brandName}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {selectedBriefDetail.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{selectedBriefDetail.productName}</h3>
              </div>
              <button
                onClick={() => setSelectedBriefDetail(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="mt-4 space-y-5 overflow-y-auto pr-1 flex-1 text-slate-800">
              {/* Deliverable Specifications Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <span className="text-[11px] font-medium text-slate-500">Retail Price</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">₹{selectedBriefDetail.productPrice}</p>
                </div>
                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3">
                  <span className="text-[11px] font-medium text-indigo-600">Commission</span>
                  <p className="text-sm font-bold text-indigo-700 mt-0.5">+{selectedBriefDetail.commissionPointsPerSale} pts/sale</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <span className="text-[11px] font-medium text-slate-500">Deliverable</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedBriefDetail.deliverableType}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <span className="text-[11px] font-medium text-slate-500">Aspect Ratio</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedBriefDetail.aspectRatio} Vertical</p>
                </div>
              </div>

              {/* Complete Script Guidelines & Talking Points */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    Complete Script Guidelines & Talking Points
                  </label>
                  <button
                    onClick={() => {
                      if (selectedBriefDetail.scriptGuidelines) {
                        navigator.clipboard.writeText(selectedBriefDetail.scriptGuidelines);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 2000);
                      }
                    }}
                    className="inline-flex items-center text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-emerald-600" />
                        <span className="text-emerald-600">Copied to clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        <span>Copy Script</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-sans shadow-inner">
                  {selectedBriefDetail.scriptGuidelines || 'No specific script guidelines provided.'}
                </div>
              </div>

              {/* Video Hooks (if provided) */}
              {selectedBriefDetail.videoHooks && (
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Target Hooks & Opening Angles
                  </label>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {selectedBriefDetail.videoHooks}
                  </div>
                </div>
              )}

              {/* Revision Feedback (if revision requested) */}
              {(selectedBriefDetail.evocReviewNotes || selectedBriefDetail.revisionNotes) && (
                <div>
                  <label className="block text-xs font-bold text-rose-800 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                    EVOC Ops Quality Review Feedback
                  </label>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 whitespace-pre-wrap leading-relaxed">
                    {selectedBriefDetail.evocReviewNotes || selectedBriefDetail.revisionNotes}
                  </div>
                </div>
              )}

              {/* Delivered Video & Campaign Details */}
              {(selectedBriefDetail.approvedVideoUrl || selectedBriefDetail.draftVideoUrl) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-indigo-600" />
                    Deliverable Video Asset
                  </span>
                  <div className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg p-2.5">
                    <span className="truncate text-slate-600 max-w-sm">
                      {selectedBriefDetail.approvedVideoUrl || selectedBriefDetail.draftVideoUrl}
                    </span>
                    <a
                      href={selectedBriefDetail.approvedVideoUrl || selectedBriefDetail.draftVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline flex-shrink-0"
                    >
                      Open Video <ArrowUpRight className="h-3 w-3 ml-0.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Contextual Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedBriefDetail(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Close View
              </button>

              <div className="flex items-center gap-2">
                {selectedBriefDetail.status === 'BRIEF_SUBMITTED' && (
                  <>
                    <button
                      onClick={() => {
                        handleDeclineDeal(selectedBriefDetail.id);
                        setSelectedBriefDetail(null);
                      }}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => {
                        handleAcceptDeal(selectedBriefDetail.id);
                        setSelectedBriefDetail(null);
                      }}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                    >
                      Accept Deal
                    </button>
                  </>
                )}

                {(selectedBriefDetail.status === 'CREATOR_ACCEPTED' ||
                  selectedBriefDetail.status === 'DRAFT_REVISION_REQUESTED') && (
                  <button
                    onClick={() => {
                      const dealId = selectedBriefDetail.id;
                      setSelectedBriefDetail(null);
                      setSelectedDealForUpload(dealId);
                      setIsUploadModalOpen(true);
                    }}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition flex items-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Draft Video
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
