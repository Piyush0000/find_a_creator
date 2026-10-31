'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Video,
  Coins,
  Building2,
  Users,
  CheckCircle2,
  Zap,
  TrendingUp,
  ChevronRight,
  Lock,
  Layers,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'merchant' | 'creator' | 'admin'>('merchant');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-600 selection:text-white">
      {/* ── Top Subtle Brand Gradient Strip ── */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600" />

      {/* ── Sticky Navbar ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-sm group-hover:bg-indigo-700 transition">
              E
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-slate-900 flex items-center gap-1">
                EVOC <span className="text-indigo-600">Labs</span>
              </span>
              <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 -mt-0.5">
                Creator Network
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600">
            <a href="#portals" className="hover:text-indigo-600 transition">Platform Portals</a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition">How It Works</a>
            <a href="#features" className="hover:text-indigo-600 transition">Security & Trust</a>
            <Link href="/creators" className="hover:text-indigo-600 transition flex items-center gap-1">
              <span>Creator Directory</span>
              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[9px] text-indigo-700 font-bold">LIVE</span>
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition hover:scale-[1.02]"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="relative">
        {/* ── Hero Section ── */}
        <section className="pt-16 pb-14 sm:pt-24 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-indigo-700 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>The Premier UGC Ad Marketplace for D2C Brands</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            High-Converting UGC Video Ads,{' '}
            <span className="text-indigo-600">
              Zero Headaches.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Connect directly with verified creators for vertical 9:16 Meta ads. Built with{' '}
            <span className="text-slate-900 font-medium">anti-leak contact privacy</span>,{' '}
            <span className="text-slate-900 font-medium">2-stage EVOC quality review</span>, and{' '}
            <span className="text-slate-900 font-medium">UTM sales attribution</span> with closed-loop EVOC Shopping Points.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/creators"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition hover:scale-[1.01]"
            >
              <Building2 className="h-4 w-4" />
              <span>Explore Creators (Merchant Portal)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl font-semibold text-xs text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition"
            >
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Join as Creator</span>
            </Link>
          </div>

          {/* Metrics Summary Strip */}
          <div className="mt-12 pt-8 border-t border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center max-w-4xl mx-auto">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">48h</div>
              <div className="text-xs text-slate-500 mt-0.5">Average Turnaround</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600">
                100%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Script Compliance</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">Zero</div>
              <div className="text-xs text-slate-500 mt-0.5">Contact Leaks</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                1:1 Pts
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Evo Store Redemption</div>
            </div>
          </div>
        </section>

        {/* ── Interactive 3-Portal Showcase ── */}
        <section id="portals" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              One Unified Platform. Three Specialized Portals.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto">
              Each stakeholder gets a purpose-built workspace engineered for speed, privacy, and zero operational friction.
            </p>

            {/* Portal Switcher Buttons */}
            <div className="mt-6 inline-flex p-1 rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => setActiveTab('merchant')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'merchant'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>D2C Merchant</span>
              </button>

              <button
                onClick={() => setActiveTab('creator')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'creator'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>UGC Creator</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'admin'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Super Admin (Ops)</span>
              </button>
            </div>
          </div>

          {/* Tab Content Cards */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
            {activeTab === 'merchant' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
                <div className="space-y-4">
                  <div className="inline-flex items-center space-x-1.5 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>D2C BRAND & MERCHANT PORTAL</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    Discover Top Creators, Brief Scripts, and Download Launch-Ready Ads.
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                    Filter creators by category and engagement. Submit structured script briefs with anti-leak protection, track draft production, and receive approved turnkey vertical MP4s with Meta Ads UTM links.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Creator Directory with verified portfolio video ad reels</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Real-time Anti-Leak shield blocks contact details and phone numbers</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>One-click asset handoff with automated Meta Ads UTM parameters</span>
                    </li>
                  </ul>
                  <div className="pt-2 flex items-center space-x-4">
                    <Link
                      href="/creators"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                    >
                      <span>Open Merchant Portal</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/signup"
                      className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
                    >
                      Register Brand →
                    </Link>
                  </div>
                </div>

                {/* Visual Preview Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center space-x-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <span className="text-[11px] font-mono text-slate-500 ml-2">/creators & /collabs</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Campaign Active
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Rohit S. — Men&apos;s Grooming</div>
                        <div className="text-[11px] text-slate-500">Vitamin C Glow Serum • 1 UGC Video Ad</div>
                      </div>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        ₹999 / 250 PTS
                      </span>
                    </div>

                    <div className="text-xs font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-600 break-all">
                      https://glowskincare.in/serum?utm_source=evoc&utm_medium=ugc&utm_creator=evoc_cr_rohit
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>Cloudflare R2 1080p MP4</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Turnkey Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'creator' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
                <div className="space-y-4">
                  <div className="inline-flex items-center space-x-1.5 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>UGC VIDEO CREATOR WORKSPACE</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    Accept Brand Briefs, Upload Direct to R2, and Earn EVOC Shopping Points.
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                    Zero hassle with invoices or direct cash disputes. Review creative briefs, shoot vertical reels, upload directly via high-speed Cloudflare R2 presigned URLs, and redeem points on curated partner stores.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Deals Pipeline with filterable status progression</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Direct 500MB browser-to-Cloudflare R2 video uploads</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>14-day clearance ledger for transparent Shopping Points maturation</span>
                    </li>
                  </ul>
                  <div className="pt-2 flex items-center space-x-4">
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                    >
                      <span>Open Creator Dashboard</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/signup"
                      className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
                    >
                      Join Network →
                    </Link>
                  </div>
                </div>

                {/* Visual Preview Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-slate-900">EVOC Shopping Points Balance</span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      1,450 PTS Available
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-sm">
                      <div>
                        <div className="font-semibold text-slate-900">Face Scrub Video Ad #4012</div>
                        <div className="text-[11px] text-slate-500">Order Attribution • 10% Commission</div>
                      </div>
                      <span className="font-bold text-emerald-600">+250 PTS</span>
                    </div>

                    <div className="flex justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-sm">
                      <div>
                        <div className="font-semibold text-slate-900">Hair Clay Routine #3988</div>
                        <div className="text-[11px] text-slate-500">Cleared from 14-day clearance window</div>
                      </div>
                      <span className="font-bold text-emerald-600">+300 PTS</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
                <div className="space-y-4">
                  <div className="inline-flex items-center space-x-1.5 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>SUPER ADMIN & EVOC OPS CONSOLE</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    Protect Quality, Enforce Brief Compliance, and Moderate Inbound Drafts.
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                    FIFO video moderation queue prevents substandard ads from ever reaching the brand. Standardized rejection tags give creators clear, actionable feedback to re-shoot within 24 hours.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>FIFO draft review queue with video player & script guidelines</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Structured rejection tags (POOR_AUDIO, WEAK_HOOK, PII_LEAK, OFF_SCRIPT)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Audit trail logs and anti-circumvention leak tracking</span>
                    </li>
                  </ul>
                  <div className="pt-2 flex items-center space-x-4">
                    <Link
                      href="/moderation"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                    >
                      <span>Open Moderation Queue</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Visual Preview Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Video className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">Video Moderation (FIFO Queue)</span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Pending Review
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 text-xs shadow-sm">
                    <div className="font-semibold text-slate-900">Rejection Reason Tags:</div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-mono text-[10px]">
                        POOR_AUDIO
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-mono text-[10px]">
                        WEAK_HOOK
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                        PII_LEAK
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                      &quot;Audio has background fan noise at 0:15. Please re-record hook with energy.&quot;
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Core Value Pillars Grid ── */}
        <section id="features" className="py-12 sm:py-16 border-t border-slate-200/80 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">ENGINEERED FOR SCALE</span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900">
              Why High-Growth D2C Brands Pick EVOC
            </h2>
            <p className="mt-2 text-slate-500 text-xs sm:text-sm">
              We eliminated the friction, privacy leaks, and quality gamble from creator marketing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Anti-Leak Contact Privacy</h3>
              <p className="mt-1.5 text-slate-500 text-xs leading-relaxed">
                Creators and merchants never share WhatsApp numbers or personal emails. In-app brief validation blocks contact leaks in real time.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Direct Cloudflare R2 Uploads</h3>
              <p className="mt-1.5 text-slate-500 text-xs leading-relaxed">
                Creators upload high-resolution 1080x1920 video ads straight to Cloudflare R2 storage via signed URLs. Zero server bottleneck, zero video quality loss.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Automated UTM Sales Attribution</h3>
              <p className="mt-1.5 text-slate-500 text-xs leading-relaxed">
                Checkout webhook listens for completed purchases, calculates commission, and credits creator Shopping Points with a 14-day locked clearance window.
              </p>
            </div>
          </div>
        </section>

        {/* ── Ready to Start Callout ── */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-8 sm:p-12 text-center shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Ready to Upgrade Your UGC Ad Pipeline?
            </h2>
            <p className="mt-2 text-slate-600 text-xs sm:text-sm max-w-lg mx-auto">
              Join dozens of D2C brands and vetted video creators collaborating seamlessly on EVOC.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
              >
                Create Account Now
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition"
              >
                Sign In to Existing Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200/80 bg-white py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              E
            </div>
            <span className="text-slate-700 font-semibold">EVOC Creator Network</span>
            <span>• Closed-loop UGC marketplace & attribution</span>
          </div>

          <div className="flex items-center space-x-5 text-slate-500">
            <Link href="/login" className="hover:text-slate-900 transition">Sign In</Link>
            <Link href="/signup" className="hover:text-slate-900 transition">Sign Up</Link>
            <Link href="/creators" className="hover:text-slate-900 transition">Creator Marketplace</Link>
            <Link href="/moderation" className="hover:text-slate-900 transition">Ops Queue</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
