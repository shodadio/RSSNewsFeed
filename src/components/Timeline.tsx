/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronLeft,
  Filter,
  CheckCircle2,
  MailCheck,
  Sparkles,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import { Article, SmartFilter, Feed, AIBriefing } from '../types';
import { SwipeableArticleCard } from './SwipeableArticleCard';
import { AIBriefCard } from './AIBriefCard';

interface TimelineProps {
  articles: Article[];
  feeds?: Feed[];
  selectedArticleId: string | null;
  onSelectArticle: (article: Article) => void;
  activeFilter: SmartFilter;
  onSelectFilter?: (filter: SmartFilter) => void;
  readArticleIds: Set<string>;
  starredArticleIds: Set<string>;
  archivedArticleIds?: Set<string>;
  onToggleStar: (articleId: string, e?: React.MouseEvent) => void;
  onDeleteArticle: (articleId: string) => void;
  onArchiveArticle: (articleId: string) => void;
  onUnarchiveArticle?: (articleId: string) => void;
  onToggleRead: (articleId: string) => void;
  onMarkAllAsRead: () => void;
  onBackToFeeds?: () => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
  isMobile: boolean;
  onUpdateArticle?: (updatedArticle: Article) => void;
  aiBriefing?: AIBriefing | null;
  isGeneratingBriefing?: boolean;
  isBriefingExpanded?: boolean;
  onGenerateBriefing?: () => void;
  onToggleBriefingCollapse?: () => void;
  onDismissBriefing?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  articles,
  feeds = [],
  selectedArticleId,
  onSelectArticle,
  activeFilter,
  onSelectFilter,
  readArticleIds,
  starredArticleIds,
  archivedArticleIds = new Set(),
  onToggleStar,
  onDeleteArticle,
  onArchiveArticle,
  onUnarchiveArticle,
  onToggleRead,
  onMarkAllAsRead,
  onBackToFeeds,
  onRefreshAll,
  isRefreshing = false,
  isMobile,
  onUpdateArticle,
  aiBriefing = null,
  isGeneratingBriefing = false,
  isBriefingExpanded = true,
  onGenerateBriefing,
  onToggleBriefingCollapse,
  onDismissBriefing
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);

  // Search is scoped to the current view. Carrying the query across a filter change
  // made "no results" indistinguishable from an empty feed.
  useEffect(() => {
    setSearchQuery('');
  }, [activeFilter.type, activeFilter.id]);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pullStartYRef = useRef(0);

  const PULL_THRESHOLD = 64; // Distance in px to trigger refresh
  const MAX_PULL = 96;

  const handleTouchStartList = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop <= 0) {
      pullStartYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    } else {
      setIsPulling(false);
    }
  };

  const handleTouchMoveList = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) {
      if (pullDistance > 0) setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - pullStartYRef.current;

    if (deltaY > 0) {
      const damped = Math.min(MAX_PULL, deltaY * 0.45);
      setPullDistance(damped);

    } else {
      if (pullDistance > 0) setPullDistance(0);
    }
  };

  const handleTouchEndList = () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && onRefreshAll && !isRefreshing) {
      onRefreshAll();
    }
    setPullDistance(0);
  };

  const filteredArticles = articles.filter((a) => {
    const isRead = readArticleIds.has(a.id);
    if (onlyUnread && isRead) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.snippet.toLowerCase().includes(q) ||
      a.feedTitle.toLowerCase().includes(q) ||
      (a.author && a.author.toLowerCase().includes(q))
    );
  });

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m`;
      if (diffHrs < 24) return `${diffHrs}h`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`${
        isMobile ? 'w-full' : 'w-full md:w-80 lg:w-96'
      } bg-black flex flex-col h-full border-r border-white/[0.08] shrink-0 select-none relative overflow-hidden`}
    >
      {/* Timeline Header with iOS Safe Area padding */}
      <div className="ios-header-safe pb-3 px-4 pt-4 border-b border-white/[0.08] bg-black/95 backdrop-blur-md sticky top-0 z-20 space-y-3 shrink-0">
        <div className="flex items-center justify-between min-h-[36px]">
          <div className="flex items-center gap-2 truncate flex-1 mr-2 min-w-0">
            {isMobile && onBackToFeeds && (
              <button
                onClick={onBackToFeeds}
                className="inline-flex items-center gap-1 py-1.5 px-2.5 -ml-1.5 text-[#0A84FF] hover:text-[#0A84FF]/80 active:bg-white/[0.08] rounded-xl transition font-semibold text-xs touch-manipulation select-none shrink-0"
                aria-label="Back to Feeds"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                <span>Feeds</span>
              </button>
            )}
            <h2 className="text-sm font-bold text-white truncate">{activeFilter.title}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.08] text-[#8E8E93] font-mono shrink-0">
              {filteredArticles.length}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onGenerateBriefing && (
              <button
                onClick={() => {
                  onGenerateBriefing();
                }}
                disabled={isGeneratingBriefing}
                className={`p-2 rounded-xl text-xs transition flex items-center gap-1 ${
                  isGeneratingBriefing
                    ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                    : 'text-[#0A84FF] hover:text-white hover:bg-white/[0.08]'
                }`}
                title="✨ AI Brief (Summarize Unread)"
              >
                <Sparkles className={`w-4 h-4 stroke-[1.5] ${isGeneratingBriefing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              aria-pressed={onlyUnread}
              aria-label="Show unread articles only"
              className={`h-8 px-2.5 rounded-xl text-[11px] font-semibold transition flex items-center gap-1.5 ${
                onlyUnread
                  ? 'bg-[#0A84FF] text-white'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.08]'
              }`}
              title={onlyUnread ? 'Showing unread only' : 'Showing all articles'}
            >
              {onlyUnread ? (
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5]" />
              ) : (
                <Filter className="w-3.5 h-3.5 stroke-[1.5]" />
              )}
              <span className="hidden sm:inline">Unread</span>
            </button>

            <button
              onClick={() => {
                onMarkAllAsRead();
              }}
              className="p-2 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] rounded-xl transition"
              aria-label="Mark all as read"
              title="Mark all as read"
            >
              <MailCheck className="w-4 h-4 stroke-[1.5]" />
            </button>

            {onRefreshAll && (
              <button
                onClick={onRefreshAll}
                disabled={isRefreshing}
                className="p-2 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] rounded-xl transition disabled:opacity-50"
                title="Refresh Feeds"
              >
                <RefreshCw className={`w-4 h-4 stroke-[1.5] ${isRefreshing ? 'animate-spin text-[#0A84FF]' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-3 top-2.5 stroke-[1.5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full bg-[#1C1C1E] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#0A84FF]"
          />
        </div>
      </div>

      {/* Pull-To-Refresh Visual Indicator */}
      <div
        className="overflow-hidden transition-[height,opacity] duration-200 ease-out flex items-center justify-center bg-black/60 border-b border-white/[0.06] text-[#8E8E93] select-none shrink-0"
        style={{
          height: isRefreshing ? '44px' : `${pullDistance}px`,
          opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 30)
        }}
      >
        <div className="flex items-center gap-2 py-1.5">
          {isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-[#0A84FF] stroke-[1.5]" />
              <span className="text-[11px] font-medium text-slate-200">Checking for new articles...</span>
            </>
          ) : (
            <>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-100"
                style={{
                  transform: `rotate(${Math.min(180, (pullDistance / PULL_THRESHOLD) * 180)}deg)`
                }}
              >
                <ArrowDown
                  className={`w-4 h-4 stroke-[1.5] transition-colors ${
                    pullDistance >= PULL_THRESHOLD ? 'text-[#0A84FF]' : 'text-[#8E8E93]'
                  }`}
                />
              </div>
              <span
                className={`text-[11px] font-medium transition-colors ${
                  pullDistance >= PULL_THRESHOLD ? 'text-white font-semibold' : 'text-[#8E8E93]'
                }`}
              >
                {pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull down to refresh'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Article List with Swipe & Long-Press Actions & Pull-To-Refresh */}
      <div
        key={`${activeFilter.type}-${activeFilter.id || ''}`}
        ref={scrollContainerRef}
        onTouchStart={handleTouchStartList}
        onTouchMove={handleTouchMoveList}
        onTouchEnd={handleTouchEndList}
        className="flex-1 overflow-y-auto divide-y divide-white/[0.06] pb-[calc(84px+max(16px,env(safe-area-inset-bottom,16px)))] overscroll-y-contain animate-list-fade bg-black"
      >
        {/* Prominent AI Briefing Card at Top of Feed List */}
        {onGenerateBriefing && (aiBriefing || isGeneratingBriefing || (!searchQuery && (activeFilter.type === 'today' || activeFilter.type === 'unread' || activeFilter.type === 'all'))) && (
          <div className="p-3 bg-black border-b border-white/[0.08]">
            <AIBriefCard
              briefing={aiBriefing ?? null}
              isLoading={isGeneratingBriefing ?? false}
              isExpanded={isBriefingExpanded ?? true}
              unreadCount={articles.filter((a) => !readArticleIds.has(a.id)).length}
              onGenerate={onGenerateBriefing}
              onToggleCollapse={onToggleBriefingCollapse ?? (() => {})}
              onDismiss={onDismissBriefing ?? (() => {})}
              variant="timeline"
            />
          </div>
        )}
        {filteredArticles.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-[#8E8E93] min-h-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] flex items-center justify-center mb-3 shadow-inner">
              <CheckCircle2 className="w-7 h-7 text-emerald-400/80 stroke-[1.5]" />
            </div>
            <p className="text-sm font-bold text-white">
              {searchQuery ? 'No Matching Articles' : 'All Caught Up'}
            </p>
            <p className="text-xs text-[#8E8E93] mt-1 max-w-xs leading-relaxed">
              {searchQuery
                ? `No stories matched "${searchQuery}". Try a different keyword.`
                : activeFilter.type === 'unread' || activeFilter.type === 'today'
                ? "You've read everything here. Enjoy your day or browse past stories."
                : 'No stories available in this view right now.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-2 min-h-[44px] bg-[#1C1C1E] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-semibold rounded-xl transition active:scale-95 flex items-center justify-center"
                >
                  Clear Search
                </button>
              )}

              {activeFilter.type !== 'all' && onSelectFilter && (
                <button
                  onClick={() => {
                    onSelectFilter({ type: 'all', title: 'All Articles' });
                  }}
                  className="px-3.5 py-2 min-h-[44px] bg-[#0A84FF] hover:bg-[#0A84FF]/90 active:bg-[#0A84FF]/80 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-[#0A84FF]/20 active:scale-95 flex items-center justify-center"
                >
                  Browse All Articles
                </button>
              )}

              {onRefreshAll && (
                <button
                  onClick={() => {
                    onRefreshAll();
                  }}
                  disabled={isRefreshing}
                  className="px-3.5 py-2 min-h-[44px] bg-[#1C1C1E] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs font-semibold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 stroke-[1.5] ${isRefreshing ? 'animate-spin text-[#0A84FF]' : ''}`} />
                  <span>Refresh Feeds</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredArticles.map((article) => {
            const isSelected = selectedArticleId === article.id;
            const isRead = readArticleIds.has(article.id);
            const isStarred = starredArticleIds.has(article.id);
            const isArchived = archivedArticleIds.has(article.id);
            const parentFeed = feeds.find((f) => f.url === article.feedUrl);
            const tags = parentFeed?.tags || [];

            return (
              <SwipeableArticleCard
                key={article.id}
                article={article}
                isSelected={isSelected}
                isRead={isRead}
                isStarred={isStarred}
                isArchived={isArchived}
                tags={tags}
                formatRelativeTime={formatRelativeTime}
                onSelect={() => onSelectArticle(article)}
                onToggleStar={onToggleStar}
                onDelete={onDeleteArticle}
                onArchive={onArchiveArticle}
                onUnarchive={onUnarchiveArticle}
                onToggleRead={onToggleRead}
                onUpdateArticle={onUpdateArticle}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
