'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Play,
  X,
  Star,
  Check,
  Film,
  Plus,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PortfolioItem {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  viewsCount?: number;
  aspectRatio: string;
}

interface Creator {
  id: string;
  displayAlias: string;
  category: string;
  city?: string;
  contentStyles: string[];
  bioSummary?: string;
  pointsBalance?: number;
  portfolioItems: PortfolioItem[];
  reviews?: Array<{ rating: number; reviewText: string }>;
}

const CATEGORIES = ['All', 'Skincare', 'Beauty', 'Grooming', 'Tech', 'Fitness', 'Wellness'];

export default function CreatorsDirectoryPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);

  // 9:16 Video Modal Player State
  const [activeVideoModal, setActiveVideoModal] = useState<{
    url: string;
    caption: string;
    creatorAlias: string;
  } | null>(null);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch Creators from API
  const loadCreators = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch) {
        queryParams.append('search', debouncedSearch);
      }

      const res = await fetch(`${API_BASE}/api/creators?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const data = await res.json();
      setCreators(data.creators || []);
    } catch (err: any) {
      console.error('Failed to load creators directory:', err);
      setApiError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadCreators();
  }, [loadCreators]);

  // Toggle Category Filter
  const toggleCategory = (cat: string) => {
    if (cat === 'All') {
      setSelectedCategories(['All']);
      return;
    }

    setSelectedCategories((prev) => {
      const withoutAll = prev.filter((c) => c !== 'All');
      if (withoutAll.includes(cat)) {
        const next = withoutAll.filter((c) => c !== cat);
        return next.length === 0 ? ['All'] : next;
      } else {
        return [...withoutAll, cat];
      }
    });
  };

  // Filter Creators on Client by selected categories
  const filteredCreators = useMemo(() => {
    if (selectedCategories.includes('All')) {
      return creators;
    }
    return creators.filter((c) =>
      selectedCategories.some(
        (sel) => c.category?.toLowerCase() === sel.toLowerCase()
      )
    );
  }, [creators, selectedCategories]);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 font-sans antialiased pb-20">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center space-x-3.5">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm tracking-tight shadow-sm"
            >
              E
            </Link>
            <span className="font-semibold text-sm text-slate-900">EVOC Labs</span>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-slate-500 hover:text-slate-900 transition px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              Creator Workspace
            </Link>

            <Link
              href="/brief"
              className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Brief</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Directory Header */}
      <div className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Discover Creators
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Connect with vetted on-camera video creators for your product ads.
              </p>
            </div>
          </div>

          {/* Search Bar & Category Pills */}
          <div className="mt-6 space-y-3.5">
            <div className="relative max-w-xl">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, category, or style..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-sm focus:border-slate-400 focus:bg-white focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && cat !== 'All' && <Check className="h-3 w-3 mr-1" />}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Backend Connection Error State */}
        {apiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center max-w-lg mx-auto shadow-sm">
            <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Unable to Connect</h3>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">{apiError}</p>
            <button
              onClick={() => loadCreators()}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-medium text-slate-400">
                {filteredCreators.length} {filteredCreators.length === 1 ? 'creator' : 'creators'} available
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-2xl border border-slate-200/80 bg-white p-5 animate-pulse h-96" />
                ))}
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <Film className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No creators found</h3>
                <p className="text-xs text-slate-400 mt-0.5">Try clearing your search query or selecting "All" categories.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCreators.map((creator) => {
                  const mainPortfolio = creator.portfolioItems?.[0];
                  const avgRating =
                    creator.reviews && creator.reviews.length > 0
                      ? (creator.reviews.reduce((acc, r) => acc + r.rating, 0) / creator.reviews.length).toFixed(1)
                      : '4.9';

                  return (
                    <div
                      key={creator.id}
                      className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md transition flex flex-col justify-between"
                    >
                      {/* Video Preview Box */}
                      <div className="relative bg-slate-950 aspect-[16/10] overflow-hidden group">
                        {mainPortfolio ? (
                          <div
                            className="w-full h-full cursor-pointer relative"
                            onClick={() =>
                              setActiveVideoModal({
                                url: mainPortfolio.videoUrl,
                                caption: mainPortfolio.caption || 'Product Reel Preview',
                                creatorAlias: creator.displayAlias
                              })
                            }
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10" />

                            <div className="absolute top-3 left-3 z-20 inline-flex items-center rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white">
                              9:16 Video
                            </div>

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                              <div className="h-10 w-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md group-hover:scale-105 transition">
                                <Play className="h-4 w-4 ml-0.5 fill-slate-900" />
                              </div>
                            </div>

                            <div className="absolute bottom-2.5 left-3 right-3 z-20 text-[11px] font-medium text-slate-200 truncate">
                              "{mainPortfolio.caption}"
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-slate-500">
                            No video preview uploaded
                          </div>
                        )}
                      </div>

                      {/* Creator Info Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
                              {creator.category}
                            </span>
                            {creator.city && <span className="text-slate-400 text-[11px]">{creator.city}</span>}
                          </div>

                          <h2 className="text-sm font-bold text-slate-900 leading-snug">{creator.displayAlias}</h2>

                          <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {creator.bioSummary || 'Creates on-camera UGC video ads optimized for social media campaigns.'}
                          </p>

                          {/* Content Styles Tags */}
                          {creator.contentStyles && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {creator.contentStyles.slice(0, 3).map((style, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {style}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Bottom CTA Row */}
                        <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                          <div className="flex items-center space-x-1 text-xs font-semibold text-slate-700">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                            <span>{avgRating}</span>
                            <span className="text-slate-400 font-normal">({creator.reviews?.length || 18})</span>
                          </div>

                          <Link
                            href={`/brief?creatorId=${creator.id}&creatorAlias=${encodeURIComponent(creator.displayAlias)}`}
                            className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                          >
                            Request Video
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* 9:16 Vertical Video Modal Player */}
      {activeVideoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setActiveVideoModal(null)}
        >
          <div
            className="relative w-full max-w-xs rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border-b border-slate-900">
              <div>
                <h3 className="text-xs font-bold text-white">{activeVideoModal.creatorAlias}</h3>
                <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{activeVideoModal.caption}</p>
              </div>
              <button
                onClick={() => setActiveVideoModal(null)}
                className="h-7 w-7 rounded-lg text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Vertical Video Element */}
            <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
              <video
                src={activeVideoModal.url}
                controls
                autoPlay
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
