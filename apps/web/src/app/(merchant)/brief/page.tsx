'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  Check,
  User
} from 'lucide-react';
import { ANTI_LEAK_PATTERNS, CreateCollabBriefSchema } from '@evoc/types';

// Friendly field names for brief validation messages
const FIELD_LABELS: Record<string, string> = {
  creatorId: 'Creator',
  productName: 'Product name',
  productUrl: 'Product URL',
  productPrice: 'Retail price',
  scriptGuidelines: 'Script guidelines',
  videoHooks: '3-second hook',
  commissionPointsPerSale: 'Commission points'
};

// Turns validation issues into one readable sentence (never a raw JSON dump)
const formatValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>) =>
  issues.map((issue) => `${FIELD_LABELS[String(issue.path[0])] || 'Field'}: ${issue.message}`).join(' • ');

// Friendly names for anti-leak rules shown under each field
const LEAK_LABELS: Record<string, string> = {
  PHONE_INDIA: 'phone number',
  PHONE_GENERIC: 'phone number',
  EMAIL: 'email address',
  SOCIAL_HANDLE: 'social handle or chat link',
  CIRCUMVENTION_KEYWORDS: 'off-platform contact phrase'
};

// Real-time red banner rendered directly below a field that contains contact info
function LeakWarning({ violations }: { violations: string[] }) {
  if (violations.length === 0) return null;
  const labels = Array.from(new Set(violations.map((v) => LEAK_LABELS[v] || v.toLowerCase().replace(/_/g, ' '))));
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
      <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
      <span>
        Remove the {labels.join(', ')} — sharing contact details is not allowed on EVOC.
      </span>
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function BriefFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCreatorId = searchParams.get('creatorId') || '';
  const preselectedCreatorAlias = searchParams.get('creatorAlias') || '';

  // Form Fields State
  const [creatorId, setCreatorId] = useState(preselectedCreatorId);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState<number | ''>('');
  const [productUrl, setProductUrl] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [commissionPoints, setCommissionPoints] = useState<number | ''>('');

  // Critical Fields scanned by Anti-Leak
  const [videoHooks, setVideoHooks] = useState('');
  const [scriptGuidelines, setScriptGuidelines] = useState('');

  // Pre-Flight Anti-Leak Violations
  const [hookViolations, setHookViolations] = useState<string[]>([]);
  const [scriptViolations, setScriptViolations] = useState<string[]>([]);
  const [productNameViolations, setProductNameViolations] = useState<string[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{
    collabId: string;
    utmTrackingSlug: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Available Creators list for dropdown
  const [creatorsList, setCreatorsList] = useState<Array<{ id: string; displayAlias: string }>>([]);

  useEffect(() => {
    async function fetchCreators() {
      try {
        const res = await fetch(`${API_BASE}/api/creators`);
        if (res.ok) {
          const data = await res.json();
          setCreatorsList(data.creators || []);
          if (!creatorId && data.creators?.length > 0) {
            setCreatorId(data.creators[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load creators for brief:', err);
      }
    }
    fetchCreators();
  }, []);

  // Client-Side Pre-Flight Anti-Leak Evaluation (Live on typing)
  const evaluateAntiLeak = (text: string): string[] => {
    const violations: string[] = [];
    for (const [rule, regex] of Object.entries(ANTI_LEAK_PATTERNS)) {
      regex.lastIndex = 0;
      if (regex.test(text)) {
        violations.push(rule);
      }
      regex.lastIndex = 0;
    }
    return violations;
  };

  // Evaluate Video Hook
  const handleHookChange = (val: string) => {
    setVideoHooks(val);
    setHookViolations(evaluateAntiLeak(val));
  };

  // Evaluate Script Guidelines
  const handleScriptChange = (val: string) => {
    setScriptGuidelines(val);
    setScriptViolations(evaluateAntiLeak(val));
  };

  // Evaluate Product Name (contact details can be hidden here too)
  const handleProductNameChange = (val: string) => {
    setProductName(val);
    setProductNameViolations(evaluateAntiLeak(val));
  };

  const allDetectedViolations = Array.from(
    new Set([...productNameViolations, ...hookViolations, ...scriptViolations])
  );
  const hasAnyViolations = allDetectedViolations.length > 0;

  // Submit Brief
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAnyViolations) return;

    if (!creatorId) {
      setSubmitError('Please select a creator from the directory before submitting.');
      return;
    }

    const briefPayload = {
      creatorId,
      productName,
      productPrice: Number(productPrice),
      productUrl: productUrl.trim(),
      scriptGuidelines,
      videoHooks,
      aspectRatio,
      deliverableType: '1 UGC Video Ad (30-60s)',
      commissionPointsPerSale: Number(commissionPoints)
    };

    // Validate with the same shared schema the API uses, before sending
    const validation = CreateCollabBriefSchema.safeParse(briefPayload);
    if (!validation.success) {
      setSubmitError(formatValidationIssues(validation.error.issues));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = localStorage.getItem('evoc_merchant_token') || localStorage.getItem('evoc_token');

      // Strict Auth Guard: If not logged in as merchant, redirect to login
      if (!token) {
        router.push('/login?redirect=/brief');
        return;
      }

      const res = await fetch(`${API_BASE}/api/collabs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(briefPayload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Server validation errors can arrive as a JSON list; show them readably
        let message: string = data.error || 'Failed to submit brief. Please try again.';
        try {
          const issues = JSON.parse(message);
          if (Array.isArray(issues)) message = formatValidationIssues(issues);
        } catch {
          // Plain-text error message
        }
        throw new Error(message);
      }

      setSubmitSuccess({
        collabId: data.collabId,
        utmTrackingSlug: data.utmTrackingSlug
      });
    } catch (err: any) {
      setSubmitError(
        err instanceof TypeError
          ? 'Unable to connect to the server. Please check your connection and try again.'
          : err.message || 'Brief submission failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="text-slate-900 pb-12">

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Video Brief
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Provide your product details, opening 3-second hook, and script talking points.
          </p>
        </div>

        {submitSuccess ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Brief Submitted Successfully</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your brief has been forwarded to the creator. Once they accept, they will receive product details for shooting.
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left border border-slate-200/80 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tracking Code</div>
              <div className="font-mono text-xs font-bold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 select-all">
                {submitSuccess.utmTrackingSlug}
              </div>
              <p className="text-[11px] text-slate-400">
                Turnkey Destination: <span className="text-indigo-600 font-medium break-all">{productUrl.trim() ? `${productUrl.trim()}${productUrl.includes('?') ? '&' : '?'}utm_content=${submitSuccess.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad` : `https://yourstore.com/p?utm_content=${submitSuccess.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`}</span>
              </p>
            </div>

            <div className="pt-3 flex justify-center space-x-3">
              <Link
                href="/collabs"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition"
              >
                Track in Collabs Hub
              </Link>
              <button
                onClick={() => {
                  setSubmitSuccess(null);
                  setVideoHooks('');
                  setScriptGuidelines('');
                  setProductName('');
                  setProductPrice('');
                  setProductUrl('');
                  setCommissionPoints('');
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Create Another Brief
              </button>
              <Link
                href="/creators"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Browse Creators
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Target Creator Selection */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Creator</h2>
              {creatorId ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm">
                      {(preselectedCreatorAlias || 'Creator').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xs font-bold text-slate-900">
                          {preselectedCreatorAlias || 'Selected Creator'}
                        </h3>
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          <Check className="h-3 w-3 mr-1" /> Locked
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        This brief will be exclusively dispatched to this creator's deal pipeline.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/creators"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition flex-shrink-0"
                  >
                    Change Creator
                  </Link>
                </div>
              ) : (
                <div className="p-5 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    No creator selected. Browse creators and click "Request Video Ad" on a creator's card.
                  </p>
                  <Link
                    href="/creators"
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    <span>Browse Creator Directory</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Product & Commercials */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Product Details</h2>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="e.g. Ceramide Barrier Cream"
                    className={`w-full rounded-xl border p-2.5 text-xs font-medium transition focus:outline-none ${
                      productNameViolations.length > 0
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                        : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-400'
                    }`}
                    required
                  />
                  <LeakWarning violations={productNameViolations} />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Product URL <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                      Hidden from Creator • Meta Ads Ready
                    </span>
                  </div>
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://yourbrand.com/products/your-product"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Paste your product page link. The creator will never see this URL. When the ad is delivered, EVOC generates your turnkey Meta Ads link pointing directly to this product.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Retail Price (₹)</label>
                  <input
                    type="number"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="799"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Commission Points per Sale
                  </label>
                  <input
                    type="number"
                    value={commissionPoints}
                    onChange={(e) => setCommissionPoints(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="100"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">100 points = ₹100 reward per sale</p>
                </div>
              </div>
            </div>

            {/* Creative Direction */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Creative Guidelines
              </h2>

              {/* Video Hook Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opening 3-Second Hook
                </label>
                <input
                  type="text"
                  value={videoHooks}
                  onChange={(e) => handleHookChange(e.target.value)}
                  placeholder="e.g. 'Tired of face washes that dry out your skin?'"
                  className={`w-full rounded-xl border p-2.5 text-xs font-medium transition focus:outline-none ${
                    hookViolations.length > 0
                      ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                      : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-400'
                  }`}
                  required
                />
                  <LeakWarning violations={hookViolations} />
              </div>

              {/* Script Guidelines Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Script Guidelines & Talking Points
                </label>
                <textarea
                  rows={4}
                  value={scriptGuidelines}
                  onChange={(e) => handleScriptChange(e.target.value)}
                  placeholder="Outline benefits, key product features, and call-to-action."
                  className={`w-full rounded-xl border p-2.5 text-xs font-medium transition focus:outline-none ${
                    scriptViolations.length > 0
                      ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                      : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-400'
                  }`}
                  required
                />
                  <LeakWarning violations={scriptViolations} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Video Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { ratio: '9:16', label: '9:16 Vertical (Reel)' },
                    { ratio: '16:9', label: '16:9 Landscape' },
                    { ratio: '1:1', label: '1:1 Square' }
                  ].map((item) => (
                    <button
                      key={item.ratio}
                      type="button"
                      onClick={() => setAspectRatio(item.ratio as any)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition flex flex-col items-center justify-center ${
                        aspectRatio === item.ratio
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5 mb-1" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-rose-600" />
                {submitError}
              </div>
            )}

            {/* Submission Button */}
            <button
              type="submit"
              disabled={isSubmitting || hasAnyViolations}
              className={`w-full py-3 rounded-xl font-semibold text-xs shadow-sm transition flex items-center justify-center ${
                hasAnyViolations
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                'Submitting Brief...'
              ) : hasAnyViolations ? (
                'Remove Contact Info to Submit'
              ) : (
                'Submit Brief'
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default function SubmitBriefPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex items-center justify-center">
          <div className="text-xs font-medium text-slate-400">Loading brief form...</div>
        </div>
      }
    >
      <BriefFormContent />
    </Suspense>
  );
}
