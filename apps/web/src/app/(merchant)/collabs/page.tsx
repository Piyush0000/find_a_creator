'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  RefreshCw,
  Lock,
  Check,
  Copy,
  Film,
  Download,
  FileText,
  X,
  FileEdit,
  Sparkles,
  Smartphone,
  ArrowUpRight,
  Video,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { clearSession } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type CollabStatus =
  | 'BRIEF_SUBMITTED'
  | 'EVOC_APPROVED'
  | 'CREATOR_ACCEPTED'
  | 'DRAFT_PENDING_EVOC'
  | 'DRAFT_REVISION_REQUESTED'
  | 'DRAFT_PENDING_MERCHANT'
  | 'ASSET_DELIVERED'
  | 'CAMPAIGN_ACTIVE'
  | 'COMPLETED'
  | 'DECLINED';

interface MerchantCollab {
  id: string;
  productName: string;
  productPrice: string | number;
  deliverableType: string;
  aspectRatio: string;
  commissionPointsPerSale: number;
  status: CollabStatus;
  productUrl?: string | null;
  scriptGuidelines?: string;
  videoHooks?: string | null;
  merchantReviewNotes?: string | null;
  draftVideoUrl?: string | null;
  draftStatusNotice?: string;
  approvedVideoUrl?: string | null;
  metaAdsUtmLink?: string;
  createdAt: string;
  creator: {
    id: string;
    displayAlias: string;
    category: string;
  };
}

const STATUS_META: Record<CollabStatus, { label: string; className: string }> = {
  BRIEF_SUBMITTED: { label: 'Brief Sent', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  EVOC_APPROVED: { label: 'Brief Cleared', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CREATOR_ACCEPTED: { label: 'Creator Accepted', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DRAFT_PENDING_EVOC: { label: 'EVOC Quality Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DRAFT_REVISION_REQUESTED: { label: 'Revision in Progress', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DRAFT_PENDING_MERCHANT: { label: 'Awaiting Your Review', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  ASSET_DELIVERED: { label: 'Asset Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CAMPAIGN_ACTIVE: { label: 'Campaign Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', className: 'bg-rose-50 text-rose-700 border-rose-200' }
};

// Collabs Hub tabs and the statuses each one shows
type CollabTab = 'active' | 'review' | 'delivered';

const TAB_GROUPS: Record<CollabTab, { label: string; statuses: CollabStatus[] }> = {
  active: {
    label: 'Active Briefs',
    statuses: ['BRIEF_SUBMITTED', 'EVOC_APPROVED', 'CREATOR_ACCEPTED']
  },
  review: {
    label: 'Under Review',
    statuses: ['DRAFT_PENDING_EVOC', 'DRAFT_REVISION_REQUESTED', 'DRAFT_PENDING_MERCHANT']
  },
  delivered: {
    label: 'Delivered Assets',
    statuses: ['ASSET_DELIVERED', 'CAMPAIGN_ACTIVE', 'COMPLETED']
  }
};

export default function MerchantCollabsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<CollabTab>('active');
  const hasPickedTab = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [collabs, setCollabs] = useState<MerchantCollab[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Brief & Script Details Modal
  const [selectedCollabDetail, setSelectedCollabDetail] = useState<MerchantCollab | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Corrections / Revision Modal
  const [revisionCollab, setRevisionCollab] = useState<MerchantCollab | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Load Merchant Collabs Feed (Strict Route Guard)
  const loadCollabs = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const activeToken = localStorage.getItem('evoc_merchant_token') || localStorage.getItem('evoc_token');

      if (!activeToken) {
        router.push('/login?redirect=/collabs');
        return;
      }

      setToken(activeToken);

      const res = await fetch(`${API_BASE}/api/collabs/merchant`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        clearSession();
        router.push('/login?redirect=/collabs');
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const data = await res.json();
      const loaded: MerchantCollab[] = data.collabs || [];
      setCollabs(loaded);

      // On first load, open the first tab that has collabs in it
      if (!hasPickedTab.current) {
        hasPickedTab.current = true;
        const firstFilled = (Object.keys(TAB_GROUPS) as CollabTab[]).find((tab) =>
          loaded.some((c) => TAB_GROUPS[tab].statuses.includes(c.status))
        );
        if (firstFilled) setActiveTab(firstFilled);
      }
    } catch (err: any) {
      console.error('Failed to load merchant collabs:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadCollabs();
  }, [loadCollabs]);

  const handleApproveDraft = async (collabId: string) => {
    if (!confirm('Approve this draft and unlock the final ad asset?')) return;
    setApprovingId(collabId);
    try {
      const res = await fetch(`${API_BASE}/api/collabs/${collabId}/merchant-approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ approved: true })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to approve draft', 'error');
        return;
      }

      showToast('Draft approved! Your final ad asset is ready in Delivered Assets.');
      if (selectedCollabDetail?.id === collabId) {
        setSelectedCollabDetail(null);
      }
      setActiveTab('delivered');
      await loadCollabs();
    } catch (err: any) {
      showToast(err.message || 'Network error while approving draft', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRequestCorrections = async () => {
    if (!revisionCollab) return;
    if (!revisionNotes.trim()) {
      showToast('Please specify the corrections or adjustments needed.', 'error');
      return;
    }

    setIsSubmittingRevision(true);
    try {
      const activeToken = token || localStorage.getItem('evoc_merchant_token') || localStorage.getItem('evoc_token');
      const res = await fetch(`${API_BASE}/api/collabs/${revisionCollab.id}/merchant-approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          approved: false,
          notes: revisionNotes.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to submit corrections', 'error');
        return;
      }

      showToast('Corrections sent to creator. Status moved to Revision in Progress.');
      setRevisionCollab(null);
      setRevisionNotes('');
      if (selectedCollabDetail?.id === revisionCollab.id) {
        setSelectedCollabDetail(null);
      }
      await loadCollabs();
    } catch (err: any) {
      showToast(err.message || 'Network error while requesting corrections', 'error');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const handleCopyUtm = async (collab: MerchantCollab) => {
    if (!collab.metaAdsUtmLink) return;
    try {
      await navigator.clipboard.writeText(collab.metaAdsUtmLink);
      setCopiedId(collab.id);
      showToast('Meta Ads UTM link copied to clipboard.');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Could not copy the link. Please copy it manually.', 'error');
    }
  };

  return (
    <div className="text-slate-900 pb-12">
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Collabs Hub</h1>
            <p className="mt-1 text-xs text-slate-500">
              Track and inspect every brief from dispatch to final ad asset handoff.
            </p>
          </div>
          <button
            onClick={loadCollabs}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition self-start"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {apiError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <span className="flex-1">{apiError}</span>
            <button
              onClick={loadCollabs}
              className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 transition"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading collaborations...</div>
        ) : collabs.length === 0 ? (
          <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-white">
            <Film className="h-6 w-6 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">No briefs yet. Pick a creator and send your first video ad brief.</p>
            <Link
              href="/creators"
              className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              <span>Create Brief</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200">
              {(Object.keys(TAB_GROUPS) as CollabTab[]).map((tab) => {
                const count = collabs.filter((c) => TAB_GROUPS[tab].statuses.includes(c.status)).length;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`-mb-px inline-flex items-center space-x-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>{TAB_GROUPS[tab].label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {collabs.filter((c) => TAB_GROUPS[activeTab].statuses.includes(c.status)).length === 0 && (
              <div className="p-8 rounded-2xl border border-slate-200/80 bg-white text-center text-xs text-slate-500">
                Nothing in {TAB_GROUPS[activeTab].label} right now.
              </div>
            )}

            <div className="space-y-3">
              {collabs.filter((c) => TAB_GROUPS[activeTab].statuses.includes(c.status)).map((collab) => {
                const meta = STATUS_META[collab.status] || STATUS_META.BRIEF_SUBMITTED;
                const finalVideo = collab.approvedVideoUrl || collab.draftVideoUrl;
                return (
                  <div
                    key={collab.id}
                    onClick={() => setSelectedCollabDetail(collab)}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-300 cursor-pointer group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                            {collab.productName}
                          </h3>
                          <span className="text-xs text-slate-400 font-normal">· ₹{collab.productPrice}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Creator: <strong className="text-slate-700">{collab.creator?.displayAlias}</strong> ({collab.creator?.category}) • {collab.deliverableType} • {collab.aspectRatio} •{' '}
                          <span className="font-semibold text-indigo-600">+{collab.commissionPointsPerSale} pts/sale</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Sent {new Date(collab.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    {/* Brief / Script preview banner */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="inline-flex items-center text-indigo-600 font-semibold group-hover:underline">
                        <FileText className="h-3 w-3 mr-1" /> View Full Brief & Script Guidelines
                      </span>
                      <span className="text-slate-400 text-[10px]">Click card to inspect</span>
                    </div>

                    {/* Creator accepted: Creator is producing the video */}
                    {collab.status === 'CREATOR_ACCEPTED' && (
                      <div className="flex items-center space-x-2 rounded-xl bg-indigo-50/60 border border-indigo-200 p-3 text-[11px] text-indigo-800">
                        <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                        <span>The creator accepted your brief and is currently shooting your 9:16 UGC video ad.</span>
                      </div>
                    )}

                    {/* Draft stays private until EVOC Ops clears it */}
                    {collab.status === 'DRAFT_PENDING_EVOC' && (
                      <div className="flex items-center space-x-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-500">
                        <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span>Locked — Under EVOC Ops Quality Check (Anti-leak stage 1 review)</span>
                      </div>
                    )}

                    {/* Revision in Progress */}
                    {collab.status === 'DRAFT_REVISION_REQUESTED' && (
                      <div className="flex flex-col gap-1 rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-[11px] text-amber-900">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                          <span>Corrections in Progress</span>
                        </div>
                        {collab.merchantReviewNotes && (
                          <p className="text-amber-800/90 pl-5 leading-relaxed italic">
                            &ldquo;{collab.merchantReviewNotes}&rdquo;
                          </p>
                        )}
                        <p className="text-amber-700 text-[10px] pl-5 mt-0.5">
                          The creator has been notified with your corrections and is producing an updated draft.
                        </p>
                      </div>
                    )}

                    {/* Awaiting Merchant Review: Allows Preview, Approval, and Correction Request */}
                    {collab.status === 'DRAFT_PENDING_MERCHANT' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-violet-50/70 border border-violet-200 p-3.5"
                      >
                        <div>
                          <p className="text-xs font-semibold text-violet-900">
                            EVOC Ops cleared this video draft!
                          </p>
                          <p className="text-[11px] text-violet-700 mt-0.5">
                            Review the video below. You can approve to unlock the final asset, or request corrections if needed.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {collab.draftVideoUrl && (
                            <a
                              href={collab.draftVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Preview Video</span>
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setRevisionCollab(collab);
                              setRevisionNotes('');
                            }}
                            className="inline-flex items-center space-x-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            <FileEdit className="h-3.5 w-3.5" />
                            <span>Request Corrections</span>
                          </button>
                          <button
                            onClick={() => handleApproveDraft(collab.id)}
                            disabled={approvingId === collab.id}
                            className="inline-flex items-center space-x-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{approvingId === collab.id ? 'Approving...' : 'Approve Asset'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Delivered Asset Link & Meta Ads UTM */}
                    {collab.metaAdsUtmLink && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl bg-emerald-50/60 border border-emerald-200 p-3"
                      >
                        <code className="flex-1 text-[11px] text-emerald-800 break-all">{collab.metaAdsUtmLink}</code>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleCopyUtm(collab)}
                            className="inline-flex items-center space-x-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>{copiedId === collab.id ? 'Copied' : 'Copy Meta Ads UTM Link'}</span>
                          </button>
                          {finalVideo && (
                            <a
                              href={finalVideo}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download MP4</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Comprehensive Brief & Script Inspection Modal */}
      {selectedCollabDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 relative my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                    Creator: {selectedCollabDetail.creator?.displayAlias}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {STATUS_META[selectedCollabDetail.status]?.label || selectedCollabDetail.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{selectedCollabDetail.productName}</h3>
              </div>
              <button
                onClick={() => setSelectedCollabDetail(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="mt-4 space-y-5 overflow-y-auto pr-1 flex-1 text-slate-800">
              {/* Specs Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <span className="text-[11px] font-medium text-slate-500">Retail Price</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">₹{selectedCollabDetail.productPrice}</p>
                </div>
                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3">
                  <span className="text-[11px] font-medium text-indigo-600">Commission</span>
                  <p className="text-sm font-bold text-indigo-700 mt-0.5">+{selectedCollabDetail.commissionPointsPerSale} pts/sale</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <span className="text-[11px] font-medium text-slate-500">Deliverable</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCollabDetail.deliverableType}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <span className="text-[11px] font-medium text-slate-500">Aspect Ratio</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedCollabDetail.aspectRatio} Vertical</p>
                </div>
              </div>

              {/* Product URL */}
              {selectedCollabDetail.productUrl && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      Product URL
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-full">
                      Hidden from Creator
                    </span>
                  </div>
                  <p className="text-xs text-indigo-900 font-mono break-all pt-0.5">
                    {selectedCollabDetail.productUrl}
                  </p>
                </div>
              )}

              {/* Script Guidelines */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    Complete Script Guidelines & Talking Points
                  </label>
                  <button
                    onClick={() => {
                      if (selectedCollabDetail.scriptGuidelines) {
                        navigator.clipboard.writeText(selectedCollabDetail.scriptGuidelines);
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
                  {selectedCollabDetail.scriptGuidelines || 'No detailed script provided.'}
                </div>
              </div>

              {/* Video Hooks */}
              {selectedCollabDetail.videoHooks && (
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Target Hooks & Angles
                  </label>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {selectedCollabDetail.videoHooks}
                  </div>
                </div>
              )}

              {/* Merchant Previous Notes (if any) */}
              {selectedCollabDetail.merchantReviewNotes && (
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
                    <FileEdit className="h-3.5 w-3.5 text-amber-600" />
                    Your Requested Corrections
                  </label>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {selectedCollabDetail.merchantReviewNotes}
                  </div>
                </div>
              )}

              {/* Video Preview (if unlocked) */}
              {(selectedCollabDetail.approvedVideoUrl || selectedCollabDetail.draftVideoUrl) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-indigo-600" />
                    Uploaded Video Deliverable
                  </span>
                  <div className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg p-2.5">
                    <span className="truncate text-slate-600 max-w-sm">
                      {selectedCollabDetail.approvedVideoUrl || selectedCollabDetail.draftVideoUrl}
                    </span>
                    <a
                      href={selectedCollabDetail.approvedVideoUrl || selectedCollabDetail.draftVideoUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline flex-shrink-0"
                    >
                      Preview Video <ArrowUpRight className="h-3 w-3 ml-0.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedCollabDetail(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Close View
              </button>

              {selectedCollabDetail.status === 'DRAFT_PENDING_MERCHANT' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const collabToRevise = selectedCollabDetail;
                      setSelectedCollabDetail(null);
                      setRevisionCollab(collabToRevise);
                      setRevisionNotes('');
                    }}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition flex items-center gap-1"
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    Request Corrections
                  </button>
                  <button
                    onClick={() => handleApproveDraft(selectedCollabDetail.id)}
                    disabled={approvingId === selectedCollabDetail.id}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition flex items-center gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{approvingId === selectedCollabDetail.id ? 'Approving...' : 'Approve Asset'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Request Corrections Modal */}
      {revisionCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 relative">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
                  Request Corrections
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{revisionCollab.productName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sent to creator: <strong>{revisionCollab.creator?.displayAlias}</strong>
                </p>
              </div>
              <button
                onClick={() => setRevisionCollab(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Describe the corrections or adjustments needed:
                </label>
                <textarea
                  rows={4}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="e.g., Please slow down the product application in the hook, make sure the packaging label is fully visible, and speak a bit louder during the benefit callout."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The creator will receive these exact revision instructions on their dashboard and can re-record and upload a new draft.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setRevisionCollab(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestCorrections}
                disabled={isSubmittingRevision || !revisionNotes.trim()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <FileEdit className="h-3.5 w-3.5" />
                <span>{isSubmittingRevision ? 'Sending...' : 'Send Revision Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
