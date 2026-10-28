'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Truck
} from 'lucide-react';
import MerchantNav from '@/components/MerchantNav';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type CollabStatus =
  | 'BRIEF_SUBMITTED'
  | 'EVOC_APPROVED'
  | 'CREATOR_ACCEPTED'
  | 'SAMPLE_DISPATCHED'
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
  draftVideoUrl?: string | null;
  draftStatusNotice?: string;
  approvedVideoUrl?: string | null;
  metaAdsUtmLink?: string;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
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
  SAMPLE_DISPATCHED: { label: 'Sample in Transit', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DRAFT_PENDING_EVOC: { label: 'EVOC Quality Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DRAFT_REVISION_REQUESTED: { label: 'Revision in Progress', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DRAFT_PENDING_MERCHANT: { label: 'Awaiting Your Review', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  ASSET_DELIVERED: { label: 'Asset Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CAMPAIGN_ACTIVE: { label: 'Campaign Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', className: 'bg-rose-50 text-rose-700 border-rose-200' }
};

export default function MerchantCollabsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [collabs, setCollabs] = useState<MerchantCollab[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sample Dispatch Form State
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [isShipping, setIsShipping] = useState(false);

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

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('evoc_merchant_token');
        router.push('/login?redirect=/collabs');
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const data = await res.json();
      setCollabs(data.collabs || []);
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
        alert(errData.error || 'Failed to approve draft');
        return;
      }

      await loadCollabs();
    } catch (err: any) {
      alert(err.message || 'Network error while approving draft');
    } finally {
      setApprovingId(null);
    }
  };

  const openShippingForm = (collabId: string) => {
    setShippingId(collabId);
    setCourierName('');
    setTrackingNumber('');
    setTrackingUrl('');
    setShippingError(null);
  };

  const handleMarkSampleShipped = async (collabId: string) => {
    if (courierName.trim().length < 2 || trackingNumber.trim().length < 3) {
      setShippingError('Enter the courier name and tracking number.');
      return;
    }

    setIsShipping(true);
    setShippingError(null);
    try {
      const res = await fetch(`${API_BASE}/api/collabs/${collabId}/sample-dispatched`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          courierName: courierName.trim(),
          trackingNumber: trackingNumber.trim(),
          ...(trackingUrl.trim() ? { trackingUrl: trackingUrl.trim() } : {})
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setShippingError(errData.error || 'Failed to record sample dispatch');
        return;
      }

      setShippingId(null);
      await loadCollabs();
    } catch (err: any) {
      setShippingError(err.message || 'Network error while recording dispatch');
    } finally {
      setIsShipping(false);
    }
  };

  const handleCopyUtm = async (collab: MerchantCollab) => {
    if (!collab.metaAdsUtmLink) return;
    try {
      await navigator.clipboard.writeText(collab.metaAdsUtmLink);
      setCopiedId(collab.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] antialiased font-sans">
      <MerchantNav />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Collabs Hub</h1>
            <p className="mt-1 text-xs text-slate-500">
              Track every brief from dispatch to final ad asset handoff.
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
            <span>{apiError}</span>
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
              className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <span>Browse Creator Directory</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {collabs.map((collab) => {
              const meta = STATUS_META[collab.status] || STATUS_META.BRIEF_SUBMITTED;
              const finalVideo = collab.approvedVideoUrl || collab.draftVideoUrl;
              return (
                <div
                  key={collab.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{collab.productName}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {collab.creator?.displayAlias} • {collab.deliverableType} • {collab.aspectRatio} •{' '}
                        {collab.commissionPointsPerSale} pts/sale
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Sent {new Date(collab.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold self-start ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {/* Creator accepted: merchant ships the product sample */}
                  {collab.status === 'CREATOR_ACCEPTED' &&
                    (shippingId === collab.id ? (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2.5">
                        <p className="text-[11px] font-semibold text-indigo-800">Sample shipment details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            value={courierName}
                            onChange={(e) => setCourierName(e.target.value)}
                            placeholder="Courier (e.g. BlueDart)"
                            className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                          />
                          <input
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="Tracking number"
                            className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                          />
                          <input
                            value={trackingUrl}
                            onChange={(e) => setTrackingUrl(e.target.value)}
                            placeholder="Tracking link (optional)"
                            className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                          />
                        </div>
                        {shippingError && <p className="text-[11px] text-rose-700">{shippingError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMarkSampleShipped(collab.id)}
                            disabled={isShipping}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                          >
                            {isShipping ? 'Saving...' : 'Confirm Shipment'}
                          </button>
                          <button
                            onClick={() => setShippingId(null)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-indigo-50/60 border border-indigo-200 p-3">
                        <p className="text-[11px] text-indigo-800">
                          The creator accepted your brief. Ship them a product sample and add the tracking details.
                        </p>
                        <button
                          onClick={() => openShippingForm(collab.id)}
                          className="inline-flex items-center space-x-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition flex-shrink-0"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          <span>Mark Sample Shipped</span>
                        </button>
                      </div>
                    ))}

                  {collab.status === 'SAMPLE_DISPATCHED' && collab.trackingNumber && (
                    <div className="flex items-center space-x-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-600">
                      <Truck className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                      <span>
                        {collab.courierName}: <span className="font-mono">{collab.trackingNumber}</span>
                      </span>
                    </div>
                  )}

                  {/* Draft stays private until EVOC Ops clears it */}
                  {(collab.status === 'DRAFT_PENDING_EVOC' || collab.status === 'DRAFT_REVISION_REQUESTED') &&
                    collab.draftStatusNotice && (
                    <div className="flex items-center space-x-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-500">
                      <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span>{collab.draftStatusNotice}</span>
                    </div>
                  )}

                  {collab.status === 'DRAFT_PENDING_MERCHANT' && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-violet-50/60 border border-violet-200 p-3">
                      <p className="text-[11px] text-violet-800">
                        EVOC Ops cleared this draft. Review it and approve to receive the final ad asset.
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {collab.draftVideoUrl && (
                          <a
                            href={collab.draftVideoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                          >
                            View Draft
                          </a>
                        )}
                        <button
                          onClick={() => handleApproveDraft(collab.id)}
                          disabled={approvingId === collab.id}
                          className="inline-flex items-center space-x-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{approvingId === collab.id ? 'Approving...' : 'Approve Draft'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {collab.metaAdsUtmLink && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl bg-emerald-50/60 border border-emerald-200 p-3">
                      <code className="flex-1 text-[11px] text-emerald-800 break-all">{collab.metaAdsUtmLink}</code>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleCopyUtm(collab)}
                          className="inline-flex items-center space-x-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>{copiedId === collab.id ? 'Copied' : 'Copy UTM Link'}</span>
                        </button>
                        {finalVideo && (
                          <a
                            href={finalVideo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Asset</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
