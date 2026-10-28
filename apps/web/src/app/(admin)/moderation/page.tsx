'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Video,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  AlertCircle,
  RefreshCw,
  Eye,
  FileText,
  User,
  Building2,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Inbox,
  Banknote,
  LogOut
} from 'lucide-react';
import { clearRoleCookie } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Collaboration {
  id: string;
  productName: string;
  productLink: string;
  productPrice: number;
  commissionPointsPerSale: number;
  scriptGuidelines: string;
  videoHooks: string;
  aspectRatio: string;
  deliverableType: string;
  status: string;
  draftVideoUrl?: string;
  evocReviewNotes?: string;
  createdAt: string;
  merchant?: {
    id: string;
    brandName: string;
    websiteUrl: string;
  };
  creator?: {
    id: string;
    displayAlias: string;
    category: string;
  };
}

interface PayoutRequestItem {
  id: string;
  pointsRedeemed: number;
  upiVpa: string;
  status: 'PENDING_UTR' | 'CLEARED' | 'REJECTED';
  utrNumber?: string;
  adminNotes?: string;
  createdAt: string;
  creator?: {
    displayAlias: string;
    category: string;
    pointsBalance: number;
  };
}

interface SecurityFlagItem {
  id: string;
  route: string;
  fields: string[];
  violations: string[];
  userId: string | null;
  role: string | null;
  createdAt: string;
}

// Standardized rejection tags so creators know exactly what to re-shoot
const REVISION_TAGS = ['Poor Audio', 'Weak Hook', 'Off-Script', 'PII Leak'] as const;

// Where a campaign stands when there is no draft waiting for EVOC review
const STATUS_NOTES: Record<string, string> = {
  BRIEF_SUBMITTED: 'Waiting for the creator to accept the brief.',
  EVOC_APPROVED: 'Waiting for the creator to accept the brief.',
  CREATOR_ACCEPTED: 'Waiting for the merchant to ship the product sample.',
  SAMPLE_DISPATCHED: "Sample is on its way. Waiting for the creator's draft video.",
  DRAFT_REVISION_REQUESTED: 'Revisions requested. Waiting for the creator to upload a new draft.',
  DRAFT_PENDING_MERCHANT: "Approved by EVOC Ops. Waiting for the merchant's final review.",
  ASSET_DELIVERED: 'Merchant approved. The final ad asset has been delivered.',
  CAMPAIGN_ACTIVE: 'The ad campaign is live.',
  COMPLETED: 'This campaign is complete.',
  DECLINED: 'The creator declined this brief.'
};

export default function AdminModerationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'drafts' | 'payouts' | 'security'>('drafts');
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Collabs Moderation State
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [selectedCollabId, setSelectedCollabId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quality Checklist Items
  const [checklist, setChecklist] = useState({
    scriptAdherence: false,
    framingApproved: false,
    noPiiLeaked: false
  });

  // Revision Tags (required when requesting revisions)
  const [revisionTags, setRevisionTags] = useState<string[]>([]);

  // Security Flag Queue State
  const [securityFlags, setSecurityFlags] = useState<SecurityFlagItem[]>([]);

  // Payouts Moderation State
  const [payouts, setPayouts] = useState<PayoutRequestItem[]>([]);
  const [clearingPayoutId, setClearingPayoutId] = useState<string | null>(null);
  const [utrNumberInput, setUtrNumberInput] = useState('');
  const [payoutNotesInput, setPayoutNotesInput] = useState('');
  const [isClearingPayout, setIsClearingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const router = useRouter();

  // Authenticate as Super Admin & Load Data (Strict Route Guard)
  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const activeToken = localStorage.getItem('evoc_admin_token') || localStorage.getItem('evoc_token');

      // Strict Auth Guard: If no token exists, redirect to login
      if (!activeToken) {
        router.push('/login?redirect=/moderation');
        return;
      }

      setToken(activeToken);

      // 1. Fetch Collaborations
      const collabsRes = await fetch(`${API_BASE}/api/collabs/admin`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (collabsRes.status === 401 || collabsRes.status === 403) {
        localStorage.removeItem('evoc_admin_token');
        router.push('/login?redirect=/moderation');
        return;
      }

      if (!collabsRes.ok) {
        throw new Error(`Collabs query failed with status ${collabsRes.status}`);
      }

      const collabsData = await collabsRes.json();
      const loadedCollabs: Collaboration[] = collabsData.collabs || [];
      setCollabs(loadedCollabs);

      // Select first draft pending EVOC review by default
      const pendingReview = loadedCollabs.filter(
        (c) => c.status === 'DRAFT_PENDING_EVOC' || c.status === 'DRAFT_REVISION_REQUESTED'
      );
      if (pendingReview.length > 0) {
        setSelectedCollabId(pendingReview[0].id);
      } else if (loadedCollabs.length > 0) {
        setSelectedCollabId(loadedCollabs[0].id);
      }

      // 2. Fetch Pending Payouts
      const payoutsRes = await fetch(`${API_BASE}/api/admin/payouts?status=PENDING_UTR`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        setPayouts(payoutsData.payouts || []);
      }

      // 3. Fetch Security Flag Queue (blocked contact leak attempts)
      const flagsRes = await fetch(`${API_BASE}/api/admin/security-flags`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (flagsRes.ok) {
        const flagsData = await flagsRes.json();
        setSecurityFlags(flagsData.flags || []);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const selectedCollab = collabs.find((c) => c.id === selectedCollabId);
  // EVOC Ops can only review a draft that is waiting in Stage 1
  const isReviewable = selectedCollab?.status === 'DRAFT_PENDING_EVOC';

  // Handle Stage 1 Video Review Approval / Rejection
  const handleReviewAction = async (approved: boolean) => {
    if (!selectedCollab) return;

    if (!approved && revisionTags.length === 0) {
      setReviewMessage({ type: 'error', text: 'Select at least one revision tag before requesting revisions.' });
      return;
    }

    setIsSubmittingReview(true);
    setReviewMessage(null);

    const tagPrefix = !approved ? `[Revision Tags: ${revisionTags.join(', ')}]` : '';
    const notes = [tagPrefix, reviewNotes.trim()].filter(Boolean).join(' ');

    try {
      const res = await fetch(`${API_BASE}/api/collabs/${selectedCollab.id}/evoc-review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          approved,
          notes: notes || 'Cleared Stage 1 quality check.'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      // Update local state
      setCollabs((prev) =>
        prev.map((c) =>
          c.id === selectedCollab.id
            ? { ...c, status: approved ? 'DRAFT_PENDING_MERCHANT' : 'DRAFT_REVISION_REQUESTED' }
            : c
        )
      );

      setReviewMessage({
        type: 'success',
        text: approved
          ? 'Draft approved! Unlocked privately for Merchant inspection.'
          : 'Revisions requested. Creator notified to submit updated draft.'
      });

      setReviewNotes('');
      setRevisionTags([]);
      setChecklist({ scriptAdherence: false, framingApproved: false, noPiiLeaked: false });
    } catch (err: any) {
      setReviewMessage({ type: 'error', text: err.message || 'Review submission failed' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Handle Clearing a Payout Request with UTR
  const handleClearPayout = async (payoutId: string) => {
    if (!utrNumberInput.trim()) {
      setPayoutMessage({ type: 'error', text: 'Please enter a valid Bank UTR number.' });
      return;
    }

    setIsClearingPayout(true);
    setPayoutMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/payouts/${payoutId}/clear`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          utrNumber: utrNumberInput.trim(),
          adminNotes: payoutNotesInput.trim() || 'Settled via Corporate Banking'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear payout');
      }

      setPayouts((prev) => prev.filter((p) => p.id !== payoutId));
      setClearingPayoutId(null);
      setUtrNumberInput('');
      setPayoutNotesInput('');
      setPayoutMessage({ type: 'success', text: `Payout cleared with UTR: ${data.payout.utrNumber}` });
    } catch (err: any) {
      setPayoutMessage({ type: 'error', text: err.message || 'Failed to clear payout' });
    } finally {
      setIsClearingPayout(false);
    }
  };

  // Handle Rejecting a Payout Request (points are refunded to the creator)
  const handleRejectPayout = async (payoutId: string) => {
    if (payoutNotesInput.trim().length < 5) {
      setPayoutMessage({ type: 'error', text: 'Enter a rejection reason (at least 5 characters) in the notes field.' });
      return;
    }

    if (!confirm('Reject this payout and refund the points to the creator?')) return;

    setIsClearingPayout(true);
    setPayoutMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/payouts/${payoutId}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ adminNotes: payoutNotesInput.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject payout');
      }

      setPayouts((prev) => prev.filter((p) => p.id !== payoutId));
      setClearingPayoutId(null);
      setUtrNumberInput('');
      setPayoutNotesInput('');
      setPayoutMessage({ type: 'success', text: 'Payout rejected. Points have been refunded to the creator.' });
    } catch (err: any) {
      setPayoutMessage({ type: 'error', text: err.message || 'Failed to reject payout' });
    } finally {
      setIsClearingPayout(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('evoc_admin_token');
    localStorage.removeItem('evoc_token');
    localStorage.removeItem('evoc_role');
    localStorage.removeItem('evoc_user');
    localStorage.removeItem('evoc_merchant_token');
    clearRoleCookie();
    router.push('/login');
  };

  const pendingDrafts = collabs.filter((c) => c.status === 'DRAFT_PENDING_EVOC');

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 font-sans antialiased pb-20">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm tracking-tight shadow-sm">
              E
            </div>
            <div>
              <span className="font-semibold text-sm text-slate-900">EVOC Operations</span>
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Admin Console
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('drafts')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'drafts'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              <span>Video Review Queue</span>
              {pendingDrafts.length > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === 'drafts'
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {pendingDrafts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('payouts')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'payouts'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Banknote className="h-3.5 w-3.5" />
              <span>Payout Clearance</span>
              {payouts.length > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === 'payouts'
                      ? 'bg-emerald-400/20 text-emerald-300'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {payouts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'security'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Security Flags</span>
              {securityFlags.length > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === 'security'
                      ? 'bg-rose-400/20 text-rose-300'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {securityFlags.length}
                </span>
              )}
            </button>

            <div className="h-4 w-px bg-slate-200" />

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Offline Connection Error */}
        {apiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center max-w-lg mx-auto shadow-sm">
            <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Unable to Connect</h3>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">{apiError}</p>
            <button
              onClick={() => loadAdminData()}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-400 mb-2" />
            <p className="text-xs font-medium text-slate-500">Loading moderation queue...</p>
          </div>
        ) : activeTab === 'drafts' ? (
          /* ========================================================================= */
          /* TAB 1: VIDEO DRAFTS QUEUE (Split-Screen Review Workspace)                */
          /* ========================================================================= */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Stage 1 Video Quality Gate</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review raw creator video deliverables before unlocking private access for brand inspection.
                </p>
              </div>
              <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                {collabs.length} Total Campaigns
              </span>
            </div>

            {collabs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No campaigns found</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Campaigns will appear here when merchants submit briefs.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Queue Column */}
                <div className="lg:col-span-4 space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                    Queue ({collabs.length})
                  </h2>

                  <div className="space-y-2 lg:max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
                    {collabs.map((collab) => {
                      const isSelected = collab.id === selectedCollabId;
                      const isPending = collab.status === 'DRAFT_PENDING_EVOC';
                      const isRevision = collab.status === 'DRAFT_REVISION_REQUESTED';
                      const isUnlocked = collab.status === 'DRAFT_PENDING_MERCHANT' || collab.status === 'ASSET_DELIVERED';

                      return (
                        <div
                          key={collab.id}
                          onClick={() => {
                            setSelectedCollabId(collab.id);
                            setReviewMessage(null);
                            setRevisionTags([]);
                          }}
                          className={`cursor-pointer rounded-xl border px-3.5 py-3 transition text-left ${
                            isSelected
                              ? 'border-slate-900 bg-white shadow-sm ring-1 ring-slate-900'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {collab.productName}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight whitespace-nowrap ${
                                isPending
                                  ? 'bg-amber-100 text-amber-800'
                                  : isRevision
                                  ? 'bg-rose-100 text-rose-800'
                                  : isUnlocked
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {collab.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-500 truncate">
                            <strong className="text-slate-700">{collab.merchant?.brandName || 'Brand'}</strong>
                            {' • '}
                            {collab.creator?.displayAlias || 'Creator'}
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-1.5">
                            <span>{collab.aspectRatio} • {collab.deliverableType}</span>
                            <span>{new Date(collab.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Stage: Detailed Review Workspace */}
                <div className="lg:col-span-8">
                  {selectedCollab ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
                      {/* Status & Identity Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                              {selectedCollab.merchant?.brandName}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-medium text-slate-500">
                              Creator: {selectedCollab.creator?.displayAlias}
                            </span>
                          </div>
                          <h2 className="text-lg font-bold text-slate-900 mt-0.5">{selectedCollab.productName}</h2>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                              selectedCollab.status === 'DRAFT_PENDING_EVOC'
                                ? 'bg-amber-100 text-amber-800'
                                : selectedCollab.status === 'DRAFT_PENDING_MERCHANT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {selectedCollab.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Brief Details (left) + Video Player (right) Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Video Player (9:16 Aspect Preview) */}
                        <div className="md:col-span-4 md:order-2 flex flex-col items-center">
                          <div className="w-full max-w-[210px] aspect-[9/16] bg-slate-950 rounded-2xl overflow-hidden shadow-md border border-slate-200 relative flex items-center justify-center">
                            {selectedCollab.draftVideoUrl ? (
                              <video
                                src={selectedCollab.draftVideoUrl}
                                controls
                                playsInline
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="p-4 text-center text-slate-400">
                                <Video className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                                <p className="text-xs font-medium text-slate-300">No draft video submitted yet</p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                  Waiting for creator to upload vertical video deliverable.
                                </p>
                              </div>
                            )}
                          </div>
                          <span className="mt-2 text-[11px] text-slate-400">
                            Format: {selectedCollab.aspectRatio} Vertical Video
                          </span>
                        </div>

                        {/* Brief Directives & Compliance Checklist */}
                        <div className="md:col-span-8 md:order-1 space-y-3">
                          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80 space-y-2.5">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Opening 3-Second Hook
                              </span>
                              <p className="text-xs font-medium text-slate-800 mt-0.5">
                                "{selectedCollab.videoHooks || 'No specific hook provided'}"
                              </p>
                            </div>

                            <div className="border-t border-slate-200/60 pt-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Script Guidelines
                              </span>
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                {selectedCollab.scriptGuidelines || 'No guidelines provided'}
                              </p>
                            </div>
                          </div>

                          {!isReviewable ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-600 space-y-2">
                              <p>
                                <span className="font-semibold text-slate-800">Nothing to review right now.</span>{' '}
                                {STATUS_NOTES[selectedCollab.status] || 'This campaign is not waiting on EVOC Ops.'}
                              </p>
                              {reviewMessage && (
                                <p className={reviewMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}>
                                  {reviewMessage.text}
                                </p>
                              )}
                            </div>
                          ) : (
                          <>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                          {/* Pre-Approval Quality Checklist */}
                          <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                            <span className="text-xs font-bold text-slate-900 block">
                              Stage 1 Compliance Checklist
                            </span>

                            <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checklist.scriptAdherence}
                                onChange={(e) =>
                                  setChecklist({ ...checklist, scriptAdherence: e.target.checked })
                                }
                                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-0"
                              />
                              <span>Script and product talking points adhered to</span>
                            </label>

                            <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checklist.framingApproved}
                                onChange={(e) =>
                                  setChecklist({ ...checklist, framingApproved: e.target.checked })
                                }
                                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-0"
                              />
                              <span>9:16 vertical framing, audio clarity, and lighting approved</span>
                            </label>

                            <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checklist.noPiiLeaked}
                                onChange={(e) =>
                                  setChecklist({ ...checklist, noPiiLeaked: e.target.checked })
                                }
                                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-0"
                              />
                              <span>Zero personal contact information or direct handles visible</span>
                            </label>
                          </div>

                          {/* Revision Tags (sent to creator with Request Revisions) */}
                          <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3.5 space-y-2">
                            <span className="text-xs font-bold text-slate-900 block">
                              Revision Tags
                              <span className="ml-1.5 font-medium text-slate-400">(required to request revisions)</span>
                            </span>
                            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
                              {REVISION_TAGS.map((tag) => (
                                <label
                                  key={tag}
                                  className="flex items-center space-x-2 cursor-pointer text-xs text-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={revisionTags.includes(tag)}
                                    onChange={(e) =>
                                      setRevisionTags((prev) =>
                                        e.target.checked ? [...prev, tag] : prev.filter((t) => t !== tag)
                                      )
                                    }
                                    className="rounded border-slate-300 text-rose-600 focus:ring-0"
                                  />
                                  <span>{tag}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          </div>

                          {/* Review Feedback Notes */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Moderation Notes / Creator Instructions:
                            </label>
                            <textarea
                              rows={2}
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              placeholder="Add optional notes for the audit trail or revision instructions for the creator..."
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                            />
                          </div>

                          {/* Status Message */}
                          {reviewMessage && (
                            <div
                              className={`rounded-xl p-3 text-xs font-medium border flex items-center space-x-2 ${
                                reviewMessage.type === 'success'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {reviewMessage.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                              )}
                              <span>{reviewMessage.text}</span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-1 flex items-center space-x-3">
                            <button
                              disabled={isSubmittingReview}
                              onClick={() => handleReviewAction(false)}
                              className="w-1/2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition disabled:opacity-50"
                            >
                              Request Revisions
                            </button>

                            <button
                              disabled={isSubmittingReview || !selectedCollab.draftVideoUrl}
                              onClick={() => handleReviewAction(true)}
                              className="w-1/2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
                            >
                              Approve & Unlock for Merchant
                            </button>
                          </div>
                          </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center text-slate-400">
                      Select a campaign from the queue to inspect.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'payouts' ? (
          /* ========================================================================= */
          /* TAB 2: PAYOUT CLEARANCE QUEUE (FIFO Bank Settlement)                      */
          /* ========================================================================= */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Creator Payout Requests</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify UPI withdrawal requests and record bank UTR numbers to clear transactions.
                </p>
              </div>
              <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                {payouts.length} Pending Clearance
              </span>
            </div>

            {payoutMessage && (
              <div
                className={`rounded-xl p-3 text-xs font-medium border flex items-center space-x-2 ${
                  payoutMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {payoutMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{payoutMessage.text}</span>
              </div>
            )}

            {payouts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">All payouts settled</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  No withdrawal requests currently pending bank UTR clearance.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-6 py-3.5">Creator</th>
                      <th className="px-6 py-3.5">Points</th>
                      <th className="px-6 py-3.5">Amount (INR)</th>
                      <th className="px-6 py-3.5">Masked UPI VPA</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {payouts.map((payout) => {
                      const isSelected = clearingPayoutId === payout.id;

                      return (
                        <React.Fragment key={payout.id}>
                          <tr className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              {payout.creator?.displayAlias || 'Creator'}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900">
                              {payout.pointsRedeemed.toLocaleString()} pts
                            </td>
                            <td className="px-6 py-4 font-semibold text-emerald-700">
                              ₹{payout.pointsRedeemed.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-600">
                              {payout.upiVpa}
                            </td>
                            <td className="px-6 py-4 text-slate-400">
                              {new Date(payout.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  setClearingPayoutId(isSelected ? null : payout.id);
                                  setUtrNumberInput('');
                                  setPayoutNotesInput('');
                                }}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                              >
                                {isSelected ? 'Cancel' : 'Review Payout'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded UTR Input Row */}
                          {isSelected && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={6} className="px-6 py-4">
                                <div className="max-w-xl space-y-3">
                                  <div className="flex items-center space-x-2">
                                    <Banknote className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs font-bold text-slate-900">
                                      Record Bank Settlement for ₹{payout.pointsRedeemed}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                        Bank UTR Reference Number:
                                      </label>
                                      <input
                                        type="text"
                                        value={utrNumberInput}
                                        onChange={(e) => setUtrNumberInput(e.target.value)}
                                        placeholder="e.g. UTR202610269871"
                                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-mono text-slate-900 focus:border-slate-400 focus:outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                        Notes (required reason if rejecting):
                                      </label>
                                      <input
                                        type="text"
                                        value={payoutNotesInput}
                                        onChange={(e) => setPayoutNotesInput(e.target.value)}
                                        placeholder="e.g. HDFC NetBanking Corp"
                                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="pt-1 flex items-center space-x-2">
                                    <button
                                      disabled={isClearingPayout}
                                      onClick={() => handleClearPayout(payout.id)}
                                      className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition shadow-sm disabled:opacity-50"
                                    >
                                      Confirm Settlement
                                    </button>
                                    <button
                                      disabled={isClearingPayout}
                                      onClick={() => handleRejectPayout(payout.id)}
                                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                                    >
                                      Reject & Refund
                                    </button>
                                    <button
                                      onClick={() => setClearingPayoutId(null)}
                                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* TAB 3: SECURITY FLAG QUEUE (Blocked Contact Leak Attempts)                */
          /* ========================================================================= */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Security Flag Queue</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live audit of contact-sharing attempts blocked by the Anti-Leak filter.
                </p>
              </div>
              <button
                onClick={() => loadAdminData()}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </button>
            </div>

            {securityFlags.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No blocked attempts</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Briefs and notes that try to share phone numbers, emails, or handles will be logged here.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-6 py-3.5">Time</th>
                      <th className="px-6 py-3.5">Source</th>
                      <th className="px-6 py-3.5">Endpoint</th>
                      <th className="px-6 py-3.5">Fields</th>
                      <th className="px-6 py-3.5 text-right">Violations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {securityFlags.map((flag) => (
                      <tr key={flag.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                          {new Date(flag.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800">
                            {flag.role ? flag.role.replace(/_/g, ' ') : 'Unknown'}
                          </span>
                          {flag.userId && (
                            <span className="block font-mono text-[10px] text-slate-400">
                              {flag.userId.slice(0, 8)}…
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-600">{flag.route}</td>
                        <td className="px-6 py-4 text-slate-600">{flag.fields.join(', ')}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {flag.violations.map((v) => (
                              <span
                                key={v}
                                className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700"
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
          </div>
        )}
      </main>
    </div>
  );
}
