/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  X,
  Rss,
  AlertCircle,
  Sparkles,
  FolderPlus,
  Tag,
  Check,
  CheckCheck,
  Layers,
  Search,
  RotateCw,
  Globe,
  Loader2
} from 'lucide-react';
import { Feed } from '../types';
import { suggestCategoriesAndTags } from '../utils/categorySuggester';
import { getAuthHeaders } from '../utils/api';
import { triggerHaptic } from '../utils/haptics';

interface AddFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedAdded: (newFeed: Feed) => void;
  onBulkFeedsAdded?: (newFeeds: Feed[]) => void;
  existingFolders: string[];
  existingFeedUrls?: string[];
}

interface RecommendedFeedItem {
  title: string;
  url: string;
  homeUrl: string;
  description: string;
  folder: string;
  favicon?: string;
}

const POPULAR_SUGGESTIONS = [
  { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', folder: 'Tech & Architecture' },
  { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', folder: 'Tech & Architecture' },
  { title: 'Hacker News', url: 'https://news.ycombinator.com/rss', folder: 'Developer News' },
  { title: 'MacRumors', url: 'https://feeds.macrumors.com/MacRumors-All', folder: 'Indie Mac & Swift' },
  { title: '9to5Mac', url: 'https://9to5mac.com/feed/', folder: 'Indie Mac & Swift' },
  { title: 'Demis Hassabis', url: 'https://demishassabis.substack.com/feed', folder: 'AI & Machine Learning' },
  { title: 'Swift.org Blog', url: 'https://www.swift.org/atom.xml', folder: 'Indie Mac & Swift' }
];

export const AddFeedModal: React.FC<AddFeedModalProps> = ({
  isOpen,
  onClose,
  onFeedAdded,
  onBulkFeedsAdded,
  existingFolders,
  existingFeedUrls = []
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modes: 'url' | 'recommended' | 'ai'
  const [mode, setMode] = useState<'url' | 'recommended' | 'ai'>('url');

  // Google Search Recommended Feeds State
  const [recommendedFeeds, setRecommendedFeeds] = useState<RecommendedFeedItem[]>([]);
  const [isFetchingRecommended, setIsFetchingRecommended] = useState(false);
  const [recommendedError, setRecommendedError] = useState<string | null>(null);
  const [recommendedSource, setRecommendedSource] = useState<string>('');
  const [justAddedUrls, setJustAddedUrls] = useState<Set<string>>(new Set());

  // AI Feed Discovery state
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<Array<{ title: string; url: string; description: string; folder: string }>>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Set of current existing URLs in user's library
  const currentLibraryUrls = useMemo(() => new Set(existingFeedUrls), [existingFeedUrls]);

  // Real-time suggestions based on URL structure and title
  const realTimeSuggestions = useMemo(() => {
    if (!url.trim()) return null;
    return suggestCategoriesAndTags(url, title);
  }, [url, title]);

  const fetchRecommendedFeeds = async () => {
    setIsFetchingRecommended(true);
    setRecommendedError(null);
    try {
      const res = await fetch('/api/ai/recommended-tech-feeds', {
        headers: getAuthHeaders(false)
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.feeds)) {
        setRecommendedFeeds(data.feeds);
        if (data.source) setRecommendedSource(data.source);
      } else {
        throw new Error(data.error || 'Failed to retrieve recommended feeds.');
      }
    } catch (err: any) {
      setRecommendedError(err.message || 'Could not load recommended feeds from Google Search.');
    } finally {
      setIsFetchingRecommended(false);
    }
  };

  // Automatically fetch recommendations when user enters 'recommended' tab if empty
  useEffect(() => {
    if (mode === 'recommended' && recommendedFeeds.length === 0 && !isFetchingRecommended) {
      fetchRecommendedFeeds();
    }
  }, [mode]);

  if (!isOpen) return null;

  const toggleTag = (t: string) => {
    const clean = t.toLowerCase().replace(/^#/, '');
    setSelectedTags((prev) =>
      prev.includes(clean) ? prev.filter((item) => item !== clean) : [...prev, clean]
    );
  };

  const handleApplyCategory = (cat: string) => {
    triggerHaptic('selection');
    setFolder(cat);
    setNewFolderName('');
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    triggerHaptic('light');
    setAiSearching(true);
    setAiError(null);
    setAiNotice(null);
    try {
      const res = await fetch('/api/ai/search-feeds', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ query: aiQuery.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiResults(data.feeds || []);
        if (data.notice) {
          setAiNotice(data.notice);
        }
        triggerHaptic('success');
      } else {
        setAiError(data.error || 'Failed to search feeds with AI.');
        triggerHaptic('error');
      }
    } catch {
      setAiError('Network error searching feeds.');
      triggerHaptic('error');
    } finally {
      setAiSearching(false);
    }
  };

  const handleSelectAiFeed = (feed: { title: string; url: string; folder: string }) => {
    triggerHaptic('selection');
    setUrl(feed.url);
    setTitle(feed.title);
    setFolder(feed.folder);
    setMode('url');
  };

  // Add a single recommended feed directly
  const handleAddSingleRecommended = (item: RecommendedFeedItem) => {
    triggerHaptic('success');
    const newFeed: Feed = {
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.title,
      url: item.url,
      homeUrl: item.homeUrl || item.url,
      folder: item.folder || 'Tech & Architecture',
      tags: ['tech', item.folder.toLowerCase().replace(/[^a-z0-9]/g, '-')],
      favicon: item.favicon || `https://www.google.com/s2/favicons?domain=${new URL(item.homeUrl || item.url).hostname}&sz=32`,
      lastFetched: new Date().toISOString()
    };

    onFeedAdded(newFeed);
    setJustAddedUrls((prev) => new Set([...prev, item.url]));
  };

  // Bulk add all recommended feeds
  const handleAddAllRecommended = () => {
    const unadded = recommendedFeeds.filter(
      (f) => !currentLibraryUrls.has(f.url) && !justAddedUrls.has(f.url)
    );
    if (unadded.length === 0) return;

    triggerHaptic('heavy');
    const newFeeds: Feed[] = unadded.map((item, idx) => {
      let domain = '';
      try {
        domain = new URL(item.homeUrl || item.url).hostname;
      } catch {}

      return {
        id: `feed-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        title: item.title,
        url: item.url,
        homeUrl: item.homeUrl || item.url,
        folder: item.folder || 'Tech & Architecture',
        tags: ['tech', 'recommended'],
        favicon: item.favicon || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : undefined),
        lastFetched: new Date().toISOString()
      };
    });

    if (onBulkFeedsAdded) {
      onBulkFeedsAdded(newFeeds);
    } else {
      newFeeds.forEach((f) => onFeedAdded(f));
    }

    const addedSet = new Set(justAddedUrls);
    unadded.forEach((f) => addedSet.add(f.url));
    setJustAddedUrls(addedSet);

    // Close after short success feedback
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      setError('Please provide an RSS feed or Substack link.');
      triggerHaptic('warning');
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic('light');

    try {
      const res = await fetch('/api/feeds/fetch', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to parse RSS feed from URL.');
      }

      // Combine user choice or automatic server recommendation
      const autoCategory = data.primaryCategory || realTimeSuggestions?.primaryCategory || 'Subscriptions';
      const finalFolder = newFolderName.trim() || folder.trim() || autoCategory;

      // Combine chosen tags or automatic server suggested tags
      const autoTags = Array.isArray(data.suggestedTags) ? data.suggestedTags : (realTimeSuggestions?.suggestedTags || []);
      const finalTags = selectedTags.length > 0 ? selectedTags : autoTags.slice(0, 4);

      const actualFeedUrl = data.feedUrl || url.trim();
      const domainHost = (() => {
        try {
          return new URL(actualFeedUrl).hostname;
        } catch {
          return '';
        }
      })();

      const newFeed: Feed = {
        id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: title.trim() || data.title || actualFeedUrl,
        url: actualFeedUrl,
        homeUrl: data.link || url.trim(),
        folder: finalFolder,
        tags: finalTags,
        favicon: domainHost ? `https://www.google.com/s2/favicons?domain=${domainHost}&sz=32` : undefined,
        lastFetched: new Date().toISOString()
      };

      triggerHaptic('success');
      onFeedAdded(newFeed);
      setUrl('');
      setTitle('');
      setFolder('');
      setNewFolderName('');
      setSelectedTags([]);
      onClose();
    } catch (err: any) {
      triggerHaptic('error');
      setError(err.message || 'Failed to fetch and parse feed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuggestion = (s: typeof POPULAR_SUGGESTIONS[0]) => {
    triggerHaptic('selection');
    setUrl(s.url);
    setTitle(s.title);
    setFolder(s.folder);
  };

  const unaddedCount = recommendedFeeds.filter(
    (f) => !currentLibraryUrls.has(f.url) && !justAddedUrls.has(f.url)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl relative text-slate-100 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Rss className="w-5 h-5 text-amber-400" />
          Add Feed or Newsletter
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Populate your reading list via direct URL, Google Search recommended feeds, or AI.
        </p>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-4 gap-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setMode('url');
            }}
            className={`h-9 flex items-center justify-center gap-1.5 px-2 rounded-lg text-xs font-semibold transition text-center truncate ${
              mode === 'url'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Rss className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Direct URL</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setMode('recommended');
              if (recommendedFeeds.length === 0) fetchRecommendedFeeds();
            }}
            className={`h-9 flex items-center justify-center gap-1.5 px-2 rounded-lg text-xs font-semibold transition text-center truncate ${
              mode === 'recommended'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                : 'text-amber-400/90 hover:text-amber-300 hover:bg-slate-900/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Add Recommended</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setMode('ai');
            }}
            className={`h-9 flex items-center justify-center gap-1.5 px-2 rounded-lg text-xs font-semibold transition text-center truncate ${
              mode === 'ai'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">AI Search</span>
          </button>
        </div>

        {/* ================= MODE: RECOMMENDED (GOOGLE SEARCH) ================= */}
        {mode === 'recommended' ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header with Google Search badge and refresh */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Popular Tech RSS Feeds
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                    Google Search
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Curated and discovered live with Google Search to help new users quickly populate their library.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  fetchRecommendedFeeds();
                }}
                disabled={isFetchingRecommended}
                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-50 shrink-0"
                title="Refresh recommendations with Google Search"
              >
                <RotateCw className={`w-4 h-4 ${isFetchingRecommended ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>

            {/* Bulk Add All Action */}
            {recommendedFeeds.length > 0 && !isFetchingRecommended && (
              <div className="min-h-[44px] flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-300 font-medium truncate">
                  {unaddedCount > 0
                    ? `${unaddedCount} new feeds available to add`
                    : 'All recommended feeds are in your library!'}
                </span>
                {unaddedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAddAllRecommended}
                    className="h-8 px-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 shadow-md shrink-0"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Add All ({unaddedCount})</span>
                  </button>
                )}
              </div>
            )}

            {/* Loading state */}
            {isFetchingRecommended ? (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                <div className="text-xs font-semibold text-slate-200">
                  Searching Google for popular tech RSS feeds...
                </div>
                <div className="text-[11px] text-slate-400">
                  Grounded live with Google Search to verify active feeds and publications
                </div>
              </div>
            ) : recommendedError ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{recommendedError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchRecommendedFeeds}
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs shrink-0 transition"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[46dvh] overflow-y-auto pr-1">
                {recommendedFeeds.map((feed, idx) => {
                  const isInLibrary = currentLibraryUrls.has(feed.url);
                  const isNewlyAdded = justAddedUrls.has(feed.url);
                  const isAdded = isInLibrary || isNewlyAdded;

                  return (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                          {feed.favicon ? (
                            <img
                              src={feed.favicon}
                              alt=""
                              className="w-4 h-4 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{feed.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-850 text-amber-400 font-mono shrink-0">
                              {feed.folder}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {feed.description}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                            {feed.url}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isAdded ? (
                          <span className="h-8 px-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg font-semibold text-xs inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>{isNewlyAdded ? 'Added' : 'In Library'}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddSingleRecommended(feed)}
                            className="h-8 px-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 rounded-lg font-bold text-xs transition inline-flex items-center gap-1 shadow-sm active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-medium">
                {recommendedSource || 'Google Search Grounded Discovery'}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="h-9 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition inline-flex items-center justify-center"
              >
                Close
              </button>
            </div>
          </div>
        ) : mode === 'ai' ? (
          /* ================= MODE: AI SEARCH ================= */
          <div className="space-y-4">
            <form onSubmit={handleAiSearch} className="space-y-3">
              <div>
                <label className="h-5 flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  <span>Search Topic, Interest, or Blog Name</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="e.g. Space exploration, AI research, Python tutorials..."
                    className="flex-1 h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
                  />
                  <button
                    type="submit"
                    disabled={aiSearching || !aiQuery.trim()}
                    className="h-10 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold transition shrink-0 inline-flex items-center justify-center"
                  >
                    {aiSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </form>

            {aiError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiNotice && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{aiNotice}</span>
              </div>
            )}

            {aiResults.length > 0 && (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  AI Feed Suggestions ({aiResults.length})
                </div>
                {aiResults.map((feed, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{feed.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-850 text-amber-400 font-mono shrink-0">
                          {feed.folder}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{feed.description}</div>
                      <div className="text-[10px] text-slate-500 truncate font-mono mt-1">{feed.url}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectAiFeed(feed)}
                      className="h-8 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-semibold transition shrink-0 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="h-9 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition inline-flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ================= MODE: DIRECT URL ================= */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick banner to jump to Google Search Recommended Feeds */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">New here? Populate your library</div>
                  <div className="text-[11px] text-slate-400 truncate">Popular tech feeds discovered via Google Search</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setMode('recommended');
                  if (recommendedFeeds.length === 0) fetchRecommendedFeeds();
                }}
                className="h-8 px-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-md inline-flex items-center gap-1.5 shrink-0 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Add Recommended</span>
              </button>
            </div>

            <div>
              <label className="h-5 flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                <Rss className="w-3.5 h-3.5 text-amber-400" />
                <span>Feed or Substack Link</span>
              </label>
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g. https://substack.com/@demishassabis or https://site.com/feed"
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
              />
            </div>

            <div>
              <label className="h-5 flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Title</span>
                <span className="text-slate-500 font-normal text-[11px] ml-1">(Optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave blank to use feed's official name"
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
              />
            </div>

            {/* Smart Category & Tag Suggestions Box */}
            {realTimeSuggestions && (
              <div className="bg-slate-950/80 border border-amber-500/20 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Auto-Suggested Categories & Tags:
                  </span>
                  <span className="text-[10px] text-slate-400">Click to apply</span>
                </div>

                {/* Suggested Folders/Categories */}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1.5">
                    Suggested Folder:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {realTimeSuggestions.suggestedCategories.map((cat) => {
                      const isSelected = (newFolderName || folder) === cat;
                      return (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => handleApplyCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          <span>{cat}</span>
                          {isSelected && <Check className="w-3 h-3 text-slate-950" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Suggested Tags */}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1.5">
                    Suggested Tags:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {realTimeSuggestions.suggestedTags.map((t) => {
                      const isActive = selectedTags.includes(t);
                      return (
                        <button
                          type="button"
                          key={t}
                          onClick={() => toggleTag(t)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition flex items-center gap-1 ${
                            isActive
                              ? 'bg-blue-500 text-white font-semibold shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                          }`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>#{t}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Folder Selection & Custom Folder */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="h-5 flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Folder Category</span>
                </label>
                <select
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-500/50 transition"
                >
                  <option value="">
                    {realTimeSuggestions?.primaryCategory
                      ? `Auto: ${realTimeSuggestions.primaryCategory}`
                      : 'Select Folder...'}
                  </option>
                  {existingFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="h-5 flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                  <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Or New Category</span>
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. AI Research"
                  className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick popular suggestions */}
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3 text-amber-400" /> Quick Popular Feeds:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SUGGESTIONS.map((s) => (
                  <button
                    type="button"
                    key={s.title}
                    onClick={() => handleSelectSuggestion(s)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] transition"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="h-10 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition inline-flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="h-10 px-5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 disabled:opacity-40 transition inline-flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10"
              >
                {loading ? 'Analyzing & Subscribing...' : 'Subscribe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

