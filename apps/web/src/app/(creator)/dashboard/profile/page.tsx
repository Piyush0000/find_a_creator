'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Camera,
  Upload,
  Play,
  Trash2,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  MapPin,
  Tag,
  Film
} from 'lucide-react';
import { useToast } from '@/components/Toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const AVAILABLE_CATEGORIES = [
  'Skincare',
  'Beauty',
  'Grooming',
  'Tech',
  'Fitness',
  'Fashion',
  'Wellness',
  'Food & Beverage',
  'Lifestyle',
  'General'
];

const POPULAR_STYLES = [
  'Unboxing',
  'Routine Breakdown',
  'Testimonial',
  'Hook + Problem + Solution',
  'Aesthetic B-Roll',
  'Before & After Demo',
  'ASMR / Texture Focus',
  'Honest Review'
];

interface PortfolioItem {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  aspectRatio: string;
  viewsCount: number;
  createdAt: string;
}

interface CreatorProfileData {
  id: string;
  displayAlias: string;
  category: string;
  city?: string | null;
  bioSummary?: string | null;
  avatarUrl?: string | null;
  contentStyles: string[];
  pointsBalance: number;
  portfolioItems: PortfolioItem[];
}

export default function CreatorProfilePage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [displayAlias, setDisplayAlias] = useState('');
  const [category, setCategory] = useState(AVAILABLE_CATEGORIES[0]);
  const [city, setCity] = useState('');
  const [bioSummary, setBioSummary] = useState('');
  const [contentStyles, setContentStyles] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);

  // Avatar Upload State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Add Video Portfolio Modal State
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoCaption, setVideoCaption] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoModalError, setVideoModalError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal
  const [activePreview, setActivePreview] = useState<{ url: string; caption?: string | null } | null>(null);

  // Load Profile
  const fetchProfile = async () => {
    const token = localStorage.getItem('evoc_token');
    if (!token) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/creators/me/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await res.json();
      const profile: CreatorProfileData = data.creator;

      setDisplayAlias(profile.displayAlias || '');
      setCategory(profile.category || AVAILABLE_CATEGORIES[0]);
      setCity(profile.city || '');
      setBioSummary(profile.bioSummary || '');
      setContentStyles(profile.contentStyles || []);
      setAvatarUrl(profile.avatarUrl || null);
      setPortfolioItems(profile.portfolioItems || []);
    } catch (err: any) {
      setError(err.message || 'Error loading profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Upload Profile Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file (JPG, PNG, WebP)', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image must be under 10MB', 'error');
      return;
    }

    const token = localStorage.getItem('evoc_token');
    if (!token) return;

    setUploadingAvatar(true);
    try {
      const res = await fetch(`${API_BASE}/api/media/upload?folder=avatars`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type,
          'x-filename': encodeURIComponent(file.name),
          'x-folder': 'avatars'
        },
        body: file
      });

      if (!res.ok) {
        throw new Error('Failed to upload image.');
      }

      const uploadData = await res.json();
      const newAvatarUrl = uploadData.publicUrl;

      // Persist to profile
      const updateRes = await fetch(`${API_BASE}/api/creators/me/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ avatarUrl: newAvatarUrl })
      });

      if (!updateRes.ok) throw new Error('Failed to update avatar.');

      setAvatarUrl(newAvatarUrl);
      showToast('Profile photo updated successfully!', 'success');

      // Update cached user
      const stored = localStorage.getItem('evoc_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.creatorProfile) {
          u.creatorProfile.avatarUrl = newAvatarUrl;
          localStorage.setItem('evoc_user', JSON.stringify(u));
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error uploading photo', 'error');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Toggle Content Style Tag
  const toggleStyle = (style: string) => {
    if (contentStyles.includes(style)) {
      setContentStyles(contentStyles.filter((s) => s !== style));
    } else {
      if (contentStyles.length >= 6) {
        showToast('Maximum 6 content styles allowed', 'info');
        return;
      }
      setContentStyles([...contentStyles, style]);
    }
  };

  // Save Basic Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayAlias.trim()) {
      showToast('Please enter your creator display name', 'error');
      return;
    }

    const token = localStorage.getItem('evoc_token');
    if (!token) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/creators/me/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayAlias: displayAlias.trim(),
          category,
          city: city.trim() || null,
          bioSummary: bioSummary.trim() || null,
          contentStyles
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      showToast('Profile saved successfully!', 'success');

      // Update local storage
      const stored = localStorage.getItem('evoc_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.creatorProfile) {
          u.creatorProfile.displayAlias = displayAlias.trim();
          u.creatorProfile.category = category;
          localStorage.setItem('evoc_user', JSON.stringify(u));
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Upload Portfolio Preview Video
  const handleAddVideoSubmit = async () => {
    setVideoModalError(null);
    if (!videoFile) {
      setVideoModalError('Please choose a video file (MP4 or MOV).');
      return;
    }

    if (!videoCaption.trim()) {
      setVideoModalError('Please enter a short caption or headline for this reel.');
      return;
    }

    const token = localStorage.getItem('evoc_token');
    if (!token) return;

    setUploadingVideo(true);
    setVideoUploadProgress(5);

    try {
      // 1. Upload video to Cloudflare R2
      const videoUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/api/media/upload?folder=portfolio`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', videoFile.type || 'video/mp4');
        xhr.setRequestHeader('x-filename', encodeURIComponent(videoFile.name));
        xhr.setRequestHeader('x-folder', 'portfolio');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 90);
            setVideoUploadProgress(Math.max(5, percent));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resData = JSON.parse(xhr.responseText);
              resolve(resData.publicUrl);
            } catch {
              reject(new Error('Invalid response from storage upload.'));
            }
          } else {
            reject(new Error('Upload to storage failed.'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(videoFile);
      });

      setVideoUploadProgress(95);

      // 2. Save Portfolio Item to DB
      const res = await fetch(`${API_BASE}/api/creators/me/portfolio`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoUrl,
          caption: videoCaption.trim(),
          aspectRatio: '9:16'
        })
      });

      if (!res.ok) {
        throw new Error('Failed to attach video to portfolio.');
      }

      const savedData = await res.json();
      setPortfolioItems([savedData.item, ...portfolioItems]);

      setVideoUploadProgress(100);
      showToast('Video preview added to your portfolio!', 'success');
      setIsAddVideoModalOpen(false);
      setVideoFile(null);
      setVideoCaption('');
    } catch (err: any) {
      setVideoModalError(err.message || 'Error uploading video.');
    } finally {
      setUploadingVideo(false);
      setVideoUploadProgress(0);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // Delete Portfolio Item
  const handleDeletePortfolioItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this video preview from your profile?')) return;

    const token = localStorage.getItem('evoc_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/creators/me/portfolio/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to remove video');

      setPortfolioItems(portfolioItems.filter((item) => item.id !== itemId));
      showToast('Video preview removed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error deleting video', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center space-x-2 text-slate-500 text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          <span>Loading creator profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <span>Creator Profile & Video Showcase</span>
          <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] text-rose-700 font-bold uppercase tracking-wider">Creator Studio</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your public marketplace bio, profile photo, and video ad previews shown to D2C brands.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Card & Avatar Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center space-x-5">
            {/* Avatar with Upload Badge */}
            <div className="relative group">
              <div className="h-20 w-20 rounded-full border-2 border-rose-200 overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-slate-400" />
                )}
              </div>

              {/* Hidden File Input */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />

              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 text-white flex items-center justify-center shadow-sm shadow-rose-500/25 hover:scale-105 transition"
                title="Upload Profile Photo"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">{displayAlias}</h2>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                  {category}
                </span>
              </div>
              {city && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-600" />
                  <span>{city}</span>
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click the camera icon to upload your portrait photo (JPG, PNG).
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right w-full sm:w-auto">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Delivered Previews
            </div>
            <div className="text-lg font-bold text-slate-900">{portfolioItems.length} Videos</div>
          </div>
        </div>

        {/* Edit Details Form */}
        <form onSubmit={handleSaveProfile} className="pt-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Alias */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Public Display Alias / Name *
              </label>
              <input
                type="text"
                required
                value={displayAlias}
                onChange={(e) => setDisplayAlias(e.target.value)}
                placeholder="e.g. NiksIndian or Priya S. — Skincare"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 px-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none transition"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                This is the name merchants see when browsing creators.
              </p>
            </div>

            {/* Niche Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Niche</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 px-3 text-xs font-medium text-slate-900 focus:bg-white focus:border-rose-500 focus:outline-none transition"
              >
                {AVAILABLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City / Location</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai, Bangalore, Delhi NCR"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 px-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none transition"
              />
            </div>

            {/* Content Styles (Chips) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Content Styles (Select up to 6)
              </label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {POPULAR_STYLES.map((style) => {
                  const isSelected = contentStyles.includes(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => toggleStyle(style)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        isSelected
                          ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-sm shadow-rose-500/25'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? `✓ ${style}` : `+ ${style}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bio Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bio Summary / Creator Headline
            </label>
            <textarea
              rows={3}
              value={bioSummary}
              onChange={(e) => setBioSummary(e.target.value)}
              placeholder="Tell brands what hooks you shoot best, your on-camera energy, and previous converting campaigns..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none transition"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/25 hover:from-rose-500 hover:to-rose-600 transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Video Previews Showcase Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Film className="h-4 w-4 text-rose-600" />
              <span>Video Previews & Showcase Reels</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These reels are played when merchants click your card on the "Find Creators" page.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddVideoModalOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-500/25 hover:from-rose-500 hover:to-rose-600 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Video Preview</span>
          </button>
        </div>

        {/* Video Grid */}
        {portfolioItems.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <Film className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-2 text-xs font-bold text-slate-800">No video previews uploaded yet</h3>
            <p className="mt-1 text-[11px] text-slate-400 max-w-sm mx-auto">
              Upload sample 9:16 vertical video reels of yourself to attract D2C brands. They appear directly on your marketplace card.
            </p>
            <button
              onClick={() => setIsAddVideoModalOpen(true)}
              className="mt-4 inline-flex items-center space-x-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Upload First Video Preview</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {portfolioItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden flex flex-col group relative"
              >
                {/* Video Preview Container */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center">
                  <video
                    src={item.videoUrl}
                    playsInline
                    muted
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />

                  {/* Play Overlay */}
                  <div
                    onClick={() => setActivePreview({ url: item.videoUrl, caption: item.caption })}
                    className="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center cursor-pointer transition"
                  >
                    <div className="h-10 w-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                      <Play className="h-4 w-4 ml-0.5 fill-slate-900" />
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeletePortfolioItem(item.id)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition shadow z-20"
                    title="Remove Video"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="absolute top-2 left-2 z-20 inline-flex items-center rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
                    9:16
                  </div>
                </div>

                {/* Caption Footer */}
                {item.caption && (
                  <div className="p-2.5 bg-slate-900 border-t border-slate-800 text-slate-200">
                    <p className="text-[11px] font-medium truncate" title={item.caption}>
                      {item.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Video Modal */}
      {isAddVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Film className="h-4 w-4 text-rose-600" />
                <span>Add Video Preview to Portfolio</span>
              </h3>
              <button
                onClick={() => {
                  if (!uploadingVideo) {
                    setIsAddVideoModalOpen(false);
                    setVideoFile(null);
                    setVideoCaption('');
                  }
                }}
                disabled={uploadingVideo}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {videoModalError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                <span>{videoModalError}</span>
              </div>
            )}

            {/* Video File Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Video File (MP4 or MOV, max 150MB)
              </label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime"
                className="hidden"
                disabled={uploadingVideo}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setVideoFile(f);
                }}
              />

              <div
                onClick={() => !uploadingVideo && videoInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
                  videoFile ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                }`}
              >
                <Upload className="mx-auto h-6 w-6 text-rose-600 mb-1" />
                <div className="text-xs font-bold text-slate-900">
                  {videoFile ? videoFile.name : 'Click to select preview video'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Any aspect ratio: 9:16 vertical reel, 16:9 landscape, or 1:1'}
                </div>
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Headline / Caption *
              </label>
              <input
                type="text"
                value={videoCaption}
                disabled={uploadingVideo}
                onChange={(e) => setVideoCaption(e.target.value)}
                placeholder="e.g. Sea Buckthorn UGC Hook Ad (3.4% ROAS)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 px-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none transition"
              />
            </div>

            {/* Upload Progress Bar */}
            {uploadingVideo && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] font-semibold text-rose-600">
                  <span>Uploading to R2 Storage...</span>
                  <span>{videoUploadProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-500 transition-all duration-200"
                    style={{ width: `${videoUploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={uploadingVideo}
                onClick={() => {
                  setIsAddVideoModalOpen(false);
                  setVideoFile(null);
                  setVideoCaption('');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uploadingVideo || !videoFile || !videoCaption.trim()}
                onClick={handleAddVideoSubmit}
                className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-500/25 hover:from-rose-500 hover:to-rose-600 transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {uploadingVideo ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload to Portfolio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {activePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
          onClick={() => setActivePreview(null)}
        >
          <div
            className="relative flex flex-col max-h-[92vh] max-w-[90vw] md:max-w-4xl w-auto overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 text-white z-10">
              <span className="text-xs font-bold truncate max-w-[280px]">
                {activePreview.caption || 'Video Preview'}
              </span>
              <button
                onClick={() => setActivePreview(null)}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-1 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-black overflow-hidden flex-1 max-h-[82vh]">
              <video
                src={activePreview.url}
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
