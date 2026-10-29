'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import { ANTI_LEAK_PATTERNS } from '@evoc/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function BriefFormContent() {
  const searchParams = useSearchParams();
  const preselectedCreatorId = searchParams.get('creatorId') || '';
  const preselectedCreatorAlias = searchParams.get('creatorAlias') || '';

  // Form Fields State
  const [creatorId, setCreatorId] = useState(preselectedCreatorId);
  const [productName, setProductName] = useState('');
  const [productLink, setProductLink] = useState('');
  const [productPrice, setProductPrice] = useState<number | ''>('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [commissionPoints, setCommissionPoints] = useState<number | ''>('');

  // Critical Fields scanned by Anti-Leak
  const [videoHooks, setVideoHooks] = useState('');
  const [scriptGuidelines, setScriptGuidelines] = useState('');

  // Pre-Flight Anti-Leak Violations
  const [hookViolations, setHookViolations] = useState<string[]>([]);
  const [scriptViolations, setScriptViolations] = useState<string[]>([]);

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

  const hasAnyViolations = hookViolations.length > 0 || scriptViolations.length > 0;
  const allDetectedViolations = Array.from(new Set([...hookViolations, ...scriptViolations]));

  // Submit Brief
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAnyViolations) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let token = localStorage.getItem('evoc_merchant_token');

      // Auto-authenticate as merchant if missing
      if (!token) {
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'founder@glowskincare.com',
            password: 'Password123!'
          })
        });

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          token = loginData.token;
          if (token) localStorage.setItem('evoc_merchant_token', token);
        }
      }

      const res = await fetch(`${API_BASE}/api/collabs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          creatorId,
          productName,
          productLink,
          productPrice: Number(productPrice),
          scriptGuidelines,
          videoHooks,
          aspectRatio,
          deliverableType: '1 UGC Video Ad (30-60s)',
          commissionPointsPerSale: Number(commissionPoints)
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit brief');
      }

      setSubmitSuccess({
        collabId: data.collabId,
        utmTrackingSlug: data.utmTrackingSlug
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Brief submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 font-sans antialiased pb-20">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
          <Link
            href="/creators"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Creators
          </Link>
          <span className="text-xs font-semibold text-slate-400">Campaign Setup</span>
        </div>
      </header>

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
                Tracking Link: <span className="text-slate-600">{`https://yourstore.com/p?utm_content=${submitSuccess.utmTrackingSlug}`}</span>
              </p>
            </div>

            <div className="pt-3 flex justify-center space-x-3">
              <button
                onClick={() => {
                  setSubmitSuccess(null);
                  setVideoHooks('');
                  setScriptGuidelines('');
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Create Another Brief
              </button>
              <Link
                href="/creators"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Back to Creators
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Live Anti-Leak Alert (Only shown when violation exists) */}
            {hasAnyViolations && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800">
                <div className="flex items-center font-semibold mb-1">
                  <ShieldAlert className="h-4 w-4 mr-1.5 text-rose-600 flex-shrink-0" />
                  Contact Information Detected
                </div>
                <p className="text-rose-600 text-[11px]">
                  Please remove personal phone numbers, email addresses, or off-platform payment phrases to submit this brief.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {allDetectedViolations.map((v) => (
                    <span
                      key={v}
                      className="rounded bg-rose-200/70 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 uppercase"
                    >
                      {v.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Target Creator Selection */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Creator</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Creator</label>
                <select
                  value={creatorId}
                  onChange={(e) => setCreatorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                  required
                >
                  {creatorsList.length === 0 ? (
                    <option value="">No creators available</option>
                  ) : (
                    creatorsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayAlias}
                      </option>
                    ))
                  )}
                </select>
                {preselectedCreatorAlias && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Selected: <strong className="text-slate-800">{preselectedCreatorAlias}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Product & Commercials */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Product Details</h2>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Ceramide Barrier Cream"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Store URL</label>
                  <input
                    type="url"
                    value={productLink}
                    onChange={(e) => setProductLink(e.target.value)}
                    placeholder="https://brand.com/products/item"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-none"
                    required
                  />
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
                          ? 'border-slate-900 bg-slate-900 text-white'
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
                  : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
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
        <div className="min-h-screen bg-[#FBFBFD] flex items-center justify-center">
          <div className="text-xs font-medium text-slate-400">Loading brief form...</div>
        </div>
      }
    >
      <BriefFormContent />
    </Suspense>
  );
}
