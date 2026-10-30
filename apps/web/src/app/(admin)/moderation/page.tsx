'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Inbox,
  X,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '@/components/Toast';

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

// Standardized rejection tags so creators know exactly what to re-shoot
const REVISION_TAGS = [
  { code: 'POOR_AUDIO', label: 'Poor Audio' },
  { code: 'WEAK_HOOK', label: 'Weak Hook' },
  { code: 'OFF_SCRIPT', label: 'Off-Script' },
  { code: 'PII_LEAK', label: 'PII Leak' },
  { code: 'BAD_LIGHTING', label: 'Bad Lighting' }
] as const;

// Where a campaign stands when there is no draft waiting for EVOC review
const STATUS_NOTES: Record<string, string> = {
  BRIEF_SUBMITTED: 'Waiting for the creator to accept the brief.',
  EVOC_APPROVED: 'Waiting for the creator to accept the brief.',
  CREATOR_ACCEPTED: 'Waiting for the merchant to ship the product sample.',
  SAMPLE_DISPATCHED: "Sample is on its way. Waiting for the creator's draft video.",
  DRAFT_REVISION_REQUESTED: 'Revisions requested. Waiting for the creator to upload a new draft.',
  DRAFT_PENDING_MERCHANT: "Approved by EVOC Ops. Waiting for the brand's final review.",
  ASSET_DELIVERED: 'Brand approved. The final ad asset has been delivered.',
  CAMPAIGN_ACTIVE: 'The ad campaign is live.',
  COMPLETED: 'This campaign is complete.',
  DECLINED: 'The creator declined this brief.'
};

const getStatusBadgeClass = (status: string) =>
  status === 'DRAFT_PENDING_EVOC'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : status === 'DRAFT_REVISION_REQUESTED' || status === 'DECLINED'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : status === 'DRAFT_PENDING_MERCHANT' || status === 'ASSET_DELIVERED'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';

export default function AdminModerationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [selectedCollabId, setSelectedCollabId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'pending' | 'all'>('pending');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Revision Request Modal
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionTags, setRevisionTags] = useState<string[]>([]);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionError, setRevisionError] = useState<string | null>(null);

  // Load Moderation Queue (Strict Route Guard)
  const loadQueue = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const activeToken = localStorage.getItem('evoc_admin_token') || localStorage.getItem('evoc_token');
      if (!activeToken) {
        router.push('/login?redirect=/moderation');
        return;
      }
      setToken(activeToken);

      const res = await fetch(`${API_BASE}/api/collabs/admin`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('evoc_admin_token');
        router.push('/login?redirect=/moderation');
        return;
      }
      if (!res.ok) {
        throw new Error(`Moderation queue failed with status ${res.status}`);
      }

      const data = await res.json();
      const loaded: Collaboration[] = data.collabs || [];
      setCollabs(loaded);

      // Select the oldest draft waiting for review (FIFO)
      const pending = loaded
        .filter((c) => c.status === 'DRAFT_PENDING_EVOC')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setSelectedCollabId(pending[0]?.id ?? loaded[0]?.id ?? null);
    } catch (err: any) {
      console.error('Failed to load moderation queue:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const pendingDrafts = collabs
    .filter((c) => c.status === 'DRAFT_PENDING_EVOC')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const queue = queueFilter === 'pending' ? pendingDrafts : collabs;
  const selectedCollab = collabs.find((c) => c.id === selectedCollabId);
  // EVOC Ops can only review a draft that is waiting in Stage 1
  const isReviewable = selectedCollab?.status === 'DRAFT_PENDING_EVOC';

  const openRevisionModal = () => {
    setRevisionTags([]);
    setRevisionNotes('');
    setRevisionError(null);
    setIsRevisionModalOpen(true);
  };

  // Submit Stage 1 review (approve, or request revisions with structured tags)
  const submitReview = async (approved: boolean) => {
    if (!selectedCollab) return;

    if (!approved && revisionTags.length === 0) {
      setRevisionError('Select at least one revision tag.');
      return;
    }

    const tagLabels = REVISION_TAGS.filter((t) => revisionTags.includes(t.code)).map((t) => t.label);
    const notes = approved
      ? 'Cleared Stage 1 quality check.'
      : [`[Revision Tags: ${tagLabels.join(', ')}]`, revisionNotes.trim()].filter(Boolean).join(' ');

    setIsSubmittingReview(true);
    try {
      const res = await fetch(`${API_BASE}/api/collabs/${selectedCollab.id}/evoc-review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ approved, notes, ...(approved ? {} : { tags: revisionTags }) })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      const nextStatus = approved ? 'DRAFT_PENDING_MERCHANT' : 'DRAFT_REVISION_REQUESTED';
      const updated = collabs.map((c) => (c.id === selectedCollab.id ? { ...c, status: nextStatus } : c));
      setCollabs(updated);

      // Instant list update: jump to the next draft waiting for review
      const nextPending = updated
        .filter((c) => c.status === 'DRAFT_PENDING_EVOC')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      if (nextPending) setSelectedCollabId(nextPending.id);

      setIsRevisionModalOpen(false);
      showToast(
        approved
          ? 'Draft approved and unlocked privately for the brand.'
          : 'Revisions requested. The creator can see your feedback.'
      );
    } catch (err: any) {
      if (approved) {
        showToast(err.message || 'Review submission failed', 'error');
      } else {
        setRevisionError(err.message || 'Review submission failed');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="text-slate-900 pb-10">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Video Moderation</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Stage 1 quality gate — review raw drafts before they unlock privately for the brand.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {(['pending', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setQueueFilter(filter)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    queueFilter === filter ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {filter === 'pending' ? `Pending Review (${pendingDrafts.length})` : `All Campaigns (${collabs.length})`}
                </button>
              ))}
            </div>
            <button
              onClick={loadQueue}
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
              onClick={loadQueue}
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin mb-2" />
            <p className="text-xs font-medium text-slate-500">Loading moderation queue...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Queue */}
            <div className="lg:col-span-3 space-y-2 lg:max-h-[calc(100vh-11rem)] overflow-y-auto pr-1">
              {queue.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                  <Inbox className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-slate-600">
                    {queueFilter === 'pending' ? 'No drafts waiting for review' : 'No campaigns yet'}
                  </p>
                </div>
              ) : (
                queue.map((collab) => {
                  const isSelected = collab.id === selectedCollabId;
                  return (
                    <button
                      key={collab.id}
                      onClick={() => setSelectedCollabId(collab.id)}
                      className={`w-full rounded-xl border bg-white px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                        isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{collab.productName}</span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap ${getStatusBadgeClass(
                            collab.status
                          )}`}
                        >
                          {collab.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 truncate">
                        {collab.merchant?.brandName || 'Brand'} • {collab.creator?.displayAlias || 'Creator'}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">{new Date(collab.createdAt).toLocaleDateString()}</p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Split-Screen Review Workspace */}
            <div className="lg:col-span-9">
              {selectedCollab ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                    <div>
                      <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
                        {selectedCollab.merchant?.brandName} • Creator: {selectedCollab.creator?.displayAlias}
                      </p>
                      <h2 className="text-lg font-bold text-slate-900">{selectedCollab.productName}</h2>
                    </div>
                    <span
                      className={`self-start rounded-md border px-2.5 py-1 text-[11px] font-bold ${getStatusBadgeClass(
                        selectedCollab.status
                      )}`}
                    >
                      {selectedCollab.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[45fr_55fr] gap-5">
                    {/* Left (45%): Brief Requirements */}
                    <div className="space-y-3">
                      <dl className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Brand</dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">{selectedCollab.merchant?.brandName}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Creator</dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">{selectedCollab.creator?.displayAlias}</dd>
                          </div>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Link</dt>
                          <dd className="mt-0.5">
                            <a
                              href={selectedCollab.productLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline break-all"
                            >
                              {selectedCollab.productLink}
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">3-Second Hook</dt>
                          <dd className="mt-0.5 font-medium text-slate-800">
                            &ldquo;{selectedCollab.videoHooks || 'No specific hook provided'}&rdquo;
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Script Talking Points</dt>
                          <dd className="mt-0.5 text-slate-600 leading-relaxed whitespace-pre-line">
                            {selectedCollab.scriptGuidelines || 'No guidelines provided'}
                          </dd>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {selectedCollab.aspectRatio} • {selectedCollab.deliverableType}
                        </div>
                      </dl>

                      {isReviewable ? (
                        <div className="flex flex-col gap-2">
                          <button
                            disabled={isSubmittingReview || !selectedCollab.draftVideoUrl}
                            onClick={() => submitReview(true)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve &amp; Unlock for Brand
                          </button>
                          <button
                            disabled={isSubmittingReview}
                            onClick={openRevisionModal}
                            className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                          >
                            Request Revisions
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">Nothing to review right now.</span>{' '}
                          {STATUS_NOTES[selectedCollab.status] || 'This campaign is not waiting on EVOC Ops.'}
                        </div>
                      )}
                    </div>

                    {/* Right (55%): 9:16 Video Player */}
                    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-950 p-3 min-h-[320px]">
                      {selectedCollab.draftVideoUrl ? (
                        <video
                          key={selectedCollab.id}
                          src={selectedCollab.draftVideoUrl}
                          controls
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="h-[min(60vh,520px)] aspect-[9/16] rounded-lg bg-black object-contain"
                        />
                      ) : (
                        <div className="py-16 text-center">
                          <Video className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-xs font-medium text-slate-300">No draft video submitted yet</p>
                          <p className="text-[11px] text-slate-500 mt-1">Waiting for the creator&apos;s 9:16 deliverable.</p>
                        </div>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <ShieldCheck className="h-3 w-3" />
                        Private stream — not visible to the brand until approved
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                  Select a campaign from the queue to inspect.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Request Revisions Modal */}
      {isRevisionModalOpen && selectedCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Request Revisions</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedCollab.productName}</p>
              </div>
              <button
                onClick={() => setIsRevisionModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">What needs to be re-shot?</p>
                <div className="grid grid-cols-2 gap-2">
                  {REVISION_TAGS.map((tag) => (
                    <label
                      key={tag.code}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition ${
                        revisionTags.includes(tag.code)
                          ? 'border-rose-200 bg-rose-50 text-rose-700 font-semibold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={revisionTags.includes(tag.code)}
                        onChange={(e) =>
                          setRevisionTags((prev) =>
                            e.target.checked ? [...prev, tag.code] : prev.filter((t) => t !== tag.code)
                          )
                        }
                        className="rounded border-slate-300 text-rose-600 focus:ring-0"
                      />
                      {tag.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes for the creator</label>
                <textarea
                  rows={3}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="e.g. Open with the product in hand and keep the hook under 3 seconds."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition"
                />
              </div>

              {revisionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                  {revisionError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setIsRevisionModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={isSubmittingReview}
                  onClick={() => submitReview(false)}
                  className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {isSubmittingReview ? 'Sending...' : 'Send to Creator'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
