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
  AlertCircle,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ArrowRight
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PortfolioItem {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string | null;
  viewsCount?: number;
  aspectRatio: string;
}

interface Creator {
  id: string;
  displayAlias: string;
  category: string;
  city?: string | null;
  contentStyles: string[];
  bioSummary?: string | null;
  avatarUrl?: string | null;
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

  // Per-Card Active Video Preview Index (for creators with multiple previews)
  const [cardVideoIndex, setCardVideoIndex] = useState<Record<string, number>>({});

  // Full Creator Profile Modal
  const [selectedCreatorDetail, setSelectedCreatorDetail] = useState<Creator | null>(null);

  // Video Modal Player State
  const [activeVideoModal, setActiveVideoModal] = useState<{
    url: string;
    caption?: string | null;
    creatorAlias: string;
    items?: PortfolioItem[];
    currentIndex?: number;
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Directory Header */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>Discover Creators</span>
                <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] text-rose-700 font-bold uppercase tracking-wider">
                  Marketplace
                </span>
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Connect with vetted on-camera video creators for high-converting product ad reels.
              </p>
            </div>
          </div>

          {/* Search Bar & Category Pills */}
          <div className="mt-5 flex flex-col lg:flex-row lg:items-center gap-3.5 lg:gap-4">
            <div className="relative w-full lg:w-96 lg:flex-shrink-0">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, category, or style..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder-slate-400 shadow-sm focus:border-rose-500 focus:bg-white focus:outline-none transition"
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
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-sm shadow-rose-500/25'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
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
      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Backend Connection Error State */}
        {apiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center max-w-lg mx-auto shadow-sm">
            <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Unable to Connect</h3>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">{apiError}</p>
            <button
              onClick={() => loadCreators()}
              className="mt-4 inline-flex items-center rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/25 hover:from-rose-500 hover:to-rose-600 transition"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-slate-500">
                {filteredCreators.length} {filteredCreators.length === 1 ? 'creator' : 'creators'} available
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="rounded-2xl border border-slate-200/80 bg-white p-5 animate-pulse h-80 shadow-sm" />
                ))}
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <Film className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No creators found</h3>
                <p className="text-xs text-slate-500 mt-0.5">Try clearing your search query or selecting "All" categories.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredCreators.map((creator) => {
                  const items = creator.portfolioItems || [];
                  const activeIdx = cardVideoIndex[creator.id] || 0;
                  const currentPortfolio = items[activeIdx] || items[0];

                  const hasReviews = creator.reviews && creator.reviews.length > 0;
                  const avgRating = hasReviews
                    ? (creator.reviews!.reduce((acc, r) => acc + r.rating, 0) / creator.reviews!.length).toFixed(1)
                    : null;

                  return (
                    <div
                      key={creator.id}
                      className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300 flex flex-col justify-between group"
                    >
                      {/* Video Preview Box */}
                      <div className="relative bg-slate-950 aspect-video overflow-hidden">
                        {currentPortfolio ? (
                          <div
                            className="w-full h-full cursor-pointer relative"
                            onClick={() =>
                              setActiveVideoModal({
                                url: currentPortfolio.videoUrl,
                                caption: currentPortfolio.caption,
                                creatorAlias: creator.displayAlias,
                                items,
                                currentIndex: activeIdx
                              })
                            }
                          >
                            {/* Render video frame preview */}
                            <video
                              src={currentPortfolio.videoUrl}
                              preload="metadata"
                              muted
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition duration-300"
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent z-10" />

                            {/* Badge */}
                            <div className="absolute top-2.5 left-2.5 z-20 inline-flex items-center rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-white">
                              Preview Reel
                            </div>

                            {/* Multiple Videos Carousel Switcher Controls */}
                            {items.length > 1 && (
                              <div
                                className="absolute top-2.5 right-2.5 z-30 flex items-center space-x-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  title="Previous video preview"
                                  onClick={() =>
                                    setCardVideoIndex((prev) => ({
                                      ...prev,
                                      [creator.id]: (activeIdx - 1 + items.length) % items.length
                                    }))
                                  }
                                  className="h-6 w-6 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition shadow backdrop-blur-xs"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs">
                                  {activeIdx + 1}/{items.length}
                                </span>
                                <button
                                  type="button"
                                  title="Next video preview"
                                  onClick={() =>
                                    setCardVideoIndex((prev) => ({
                                      ...prev,
                                      [creator.id]: (activeIdx + 1) % items.length
                                    }))
                                  }
                                  className="h-6 w-6 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition shadow backdrop-blur-xs"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                              <div className="h-10 w-10 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                                <Play className="h-4 w-4 ml-0.5 fill-slate-900" />
                              </div>
                            </div>

                            {currentPortfolio.caption && (
                              <div className="absolute bottom-2.5 left-3 right-3 z-20 text-[11px] font-medium text-slate-100 truncate">
                                "{currentPortfolio.caption}"
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-slate-500">
                            No video preview uploaded
                          </div>
                        )}
                      </div>

                      {/* Creator Info Body */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-rose-600 text-[11px] uppercase tracking-wider">
                              {creator.category}
                            </span>
                            {creator.city && (
                              <span className="text-slate-400 text-[11px] flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                <span>{creator.city}</span>
                              </span>
                            )}
                          </div>

                          <div
                            className="flex items-center space-x-2.5 cursor-pointer"
                            onClick={() => setSelectedCreatorDetail(creator)}
                            title="Click to view full profile"
                          >
                            {creator.avatarUrl ? (
                              <img
                                src={creator.avatarUrl}
                                alt={creator.displayAlias}
                                className="h-8 w-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 text-xs font-bold text-white shadow-sm shadow-rose-500/25 flex-shrink-0">
                                {creator.displayAlias.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <h2 className="text-sm font-bold text-slate-900 hover:text-rose-600 transition leading-snug">
                              {creator.displayAlias}
                            </h2>
                          </div>

                          {creator.bioSummary && (
                            <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {creator.bioSummary}
                            </p>
                          )}

                          {/* Content Styles Tags */}
                          {creator.contentStyles && creator.contentStyles.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {creator.contentStyles.slice(0, 3).map((style, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-md bg-slate-100 border border-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {style}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Bottom Action Row */}
                        <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center">
                            {hasReviews ? (
                              <div className="flex items-center space-x-1 text-xs font-semibold text-slate-700">
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                                <span>{avgRating}</span>
                                <span className="text-slate-400 font-normal">({creator.reviews!.length})</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">New Creator</span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCreatorDetail(creator)}
                              className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                              title="Open detailed creator profile"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                              <span>Profile</span>
                            </button>

                            <Link
                              href={`/brief?creatorId=${creator.id}&creatorAlias=${encodeURIComponent(creator.displayAlias)}`}
                              className="inline-flex items-center rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/25 hover:from-rose-500 hover:to-rose-600 transition"
                            >
                              Request Video
                            </Link>
                          </div>
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

      {/* ── Creator Full Detailed Profile Modal ── */}
      {selectedCreatorDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
          onClick={() => setSelectedCreatorDetail(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-auto animate-fade-in flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div className="flex items-center space-x-4">
                {selectedCreatorDetail.avatarUrl ? (
                  <img
                    src={selectedCreatorDetail.avatarUrl}
                    alt={selectedCreatorDetail.displayAlias}
                    className="h-16 w-16 rounded-full object-cover border-2 border-rose-200 shadow-sm"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 text-white font-bold text-2xl flex items-center justify-center shadow-md shadow-rose-500/25">
                    {selectedCreatorDetail.displayAlias.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedCreatorDetail.displayAlias}</h2>
                    <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 uppercase">
                      {selectedCreatorDetail.category}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    {selectedCreatorDetail.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-rose-500" />
                        <span>{selectedCreatorDetail.city}</span>
                      </span>
                    )}
                    {selectedCreatorDetail.reviews && selectedCreatorDetail.reviews.length > 0 ? (
                      <span className="flex items-center gap-1 text-slate-700 font-semibold">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                        {(selectedCreatorDetail.reviews.reduce((acc, r) => acc + r.rating, 0) / selectedCreatorDetail.reviews.length).toFixed(1)}{' '}
                        ({selectedCreatorDetail.reviews.length} reviews)
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">New Creator</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedCreatorDetail(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Bio Summary */}
              {selectedCreatorDetail.bioSummary && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    About Creator & On-Camera Style
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    {selectedCreatorDetail.bioSummary}
                  </p>
                </div>
              )}

              {/* Content Styles Tags */}
              {selectedCreatorDetail.contentStyles && selectedCreatorDetail.contentStyles.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Content Formats & Hooks Shot Best
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCreatorDetail.contentStyles.map((style, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-rose-50 border border-rose-200/80 px-2.5 py-1 text-xs font-medium text-rose-700"
                      >
                        ✓ {style}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Video Portfolio Showcase */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Film className="h-4 w-4 text-rose-600" />
                    <span>Video Previews Showcase ({selectedCreatorDetail.portfolioItems?.length || 0} Reels)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Click any video to play preview</span>
                </div>

                {(!selectedCreatorDetail.portfolioItems || selectedCreatorDetail.portfolioItems.length === 0) ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                    No video previews uploaded yet by this creator.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedCreatorDetail.portfolioItems.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          setActiveVideoModal({
                            url: item.videoUrl,
                            caption: item.caption,
                            creatorAlias: selectedCreatorDetail.displayAlias,
                            items: selectedCreatorDetail.portfolioItems,
                            currentIndex: idx
                          })
                        }
                        className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 aspect-video relative cursor-pointer group shadow-xs hover:shadow-md transition"
                      >
                        <video
                          src={item.videoUrl}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10" />

                        <div className="absolute top-2 left-2 z-20 inline-flex items-center rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
                          Reel {idx + 1}
                        </div>

                        <div className="absolute inset-0 z-20 flex items-center justify-center">
                          <div className="h-10 w-10 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                            <Play className="h-4 w-4 ml-0.5 fill-slate-900" />
                          </div>
                        </div>

                        {item.caption && (
                          <div className="absolute bottom-2 left-2.5 right-2.5 z-20 text-[11px] font-medium text-white truncate">
                            "{item.caption}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedCreatorDetail(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Close
              </button>

              <Link
                href={`/brief?creatorId=${selectedCreatorDetail.id}&creatorAlias=${encodeURIComponent(selectedCreatorDetail.displayAlias)}`}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/25 hover:from-rose-500 hover:to-rose-600 transition"
              >
                <span>Request Video Ad with {selectedCreatorDetail.displayAlias}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Natural Resolution Video Modal Player ── */}
      {activeVideoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
          onClick={() => setActiveVideoModal(null)}
        >
          <div
            className="relative flex flex-col max-h-[92vh] max-w-[90vw] md:max-w-4xl w-auto overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 z-10">
              <div className="min-w-0 pr-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-bold text-white truncate">{activeVideoModal.creatorAlias}</h3>
                  {activeVideoModal.items && activeVideoModal.items.length > 1 && activeVideoModal.currentIndex !== undefined && (
                    <span className="rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[9px] font-bold">
                      Reel {activeVideoModal.currentIndex + 1} of {activeVideoModal.items.length}
                    </span>
                  )}
                </div>
                {activeVideoModal.caption && (
                  <p className="text-[11px] text-zinc-400 truncate">{activeVideoModal.caption}</p>
                )}
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* Previous & Next Switchers in Modal */}
                {activeVideoModal.items && activeVideoModal.items.length > 1 && activeVideoModal.currentIndex !== undefined && (
                  <div className="flex items-center space-x-1 mr-2">
                    <button
                      type="button"
                      title="Previous video"
                      onClick={() => {
                        const items = activeVideoModal.items!;
                        const nextIdx = (activeVideoModal.currentIndex! - 1 + items.length) % items.length;
                        setActiveVideoModal({
                          url: items[nextIdx].videoUrl,
                          caption: items[nextIdx].caption,
                          creatorAlias: activeVideoModal.creatorAlias,
                          items,
                          currentIndex: nextIdx
                        });
                      }}
                      className="h-7 w-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Next video"
                      onClick={() => {
                        const items = activeVideoModal.items!;
                        const nextIdx = (activeVideoModal.currentIndex! + 1) % items.length;
                        setActiveVideoModal({
                          url: items[nextIdx].videoUrl,
                          caption: items[nextIdx].caption,
                          creatorAlias: activeVideoModal.creatorAlias,
                          items,
                          currentIndex: nextIdx
                        });
                      }}
                      className="h-7 w-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setActiveVideoModal(null)}
                  className="h-7 w-7 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Video Element - Preserves uploaded aspect ratio and dimensions */}
            <div className="flex items-center justify-center bg-black overflow-hidden flex-1 max-h-[82vh]">
              <video
                key={activeVideoModal.url}
                src={activeVideoModal.url}
                controls
                autoPlay
                playsInline
                className="max-h-[80vh] max-w-[85vw] md:max-w-3xl w-auto h-auto object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
