/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  CircleDot,
  Star,
  Archive,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Rss,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  BookOpen,
  Tag,
  Trash2
} from 'lucide-react';
import { Feed, SmartFilter, AIBriefing } from '../types';
import { PWAInstallGuide } from './PWAInstallGuide';
import { AIBriefCard } from './AIBriefCard';
import { formatTag, isMetaTag } from '../utils/tagUtils';
import { ConfirmDialog } from './ConfirmDialog';

interface SidebarProps {
  feeds: Feed[];
  activeFilter: SmartFilter;
  onSelectFilter: (filter: SmartFilter) => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  onOpenAddFeed: () => void;
  onOpenSettings: () => void;
  onOpenReader?: () => void;
  onDeleteFeed?: (feedId: string) => void;
  unreadCountByFeed: Record<string, number>;
  totalUnreadCount: number;
  todayCount: number;
  starredCount: number;
  archivedCount: number;
  isMobile?: boolean;
  aiBriefing?: AIBriefing | null;
  isGeneratingBriefing?: boolean;
  isBriefingExpanded?: boolean;
  onGenerateBriefing?: () => void;
  onToggleBriefingCollapse?: () => void;
  onDismissBriefing?: () => void;
}

interface FolderFeedsListProps {
  folderFeeds: Feed[];
  activeFilter: SmartFilter;
  unreadCountByFeed: Record<string, number>;
  onSelectFilter: (filter: SmartFilter) => void;
  isFeedActive: (feedId: string) => boolean;
  onOpenFeedMenu: (feed: Feed) => void;
}

const FolderFeedsList: React.FC<FolderFeedsListProps> = ({
  folderFeeds,
  activeFilter,
  unreadCountByFeed,
  onSelectFilter,
  isFeedActive,
  onOpenFeedMenu
}) => {
  return (
    <div className="bg-black/20 divide-y divide-white/[0.04] relative">
      {folderFeeds.map((feed) => {
        const active = isFeedActive(feed.id);
        const count = unreadCountByFeed[feed.id] || 0;

        return (
          <div key={feed.id} className="relative">
            <button
              onClick={() => {
                onSelectFilter({ type: 'feed', id: feed.id, title: feed.title });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenFeedMenu(feed);
              }}
              className={`w-full flex items-center justify-between pl-9 pr-3.5 min-h-[44px] transition text-left select-none ${
                active ? 'bg-[#0A84FF] text-white font-semibold' : 'text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate pr-2">
                {feed.favicon ? (
                  <img
                    src={feed.favicon}
                    alt=""
                    className="w-4 h-4 rounded shrink-0 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93] shrink-0" />
                )}
                <span className="truncate">{feed.title}</span>
              </div>

              <span className={`text-xs font-normal shrink-0 ${active ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                {count > 0 ? count : ''}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  feeds,
  activeFilter,
  onSelectFilter,
  onRefreshAll,
  isRefreshing,
  onOpenAddFeed,
  onOpenSettings,
  onOpenReader,
  onDeleteFeed,
  unreadCountByFeed,
  totalUnreadCount,
  todayCount,
  starredCount,
  archivedCount = 0,
  isMobile = false,
  aiBriefing = null,
  isGeneratingBriefing = false,
  isBriefingExpanded = true,
  onGenerateBriefing,
  onToggleBriefingCollapse,
  onDismissBriefing
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [feedActionTarget, setFeedActionTarget] = useState<Feed | null>(null);
  const [confirmDeleteFeed, setConfirmDeleteFeed] = useState<Feed | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  // Group feeds by folder
  const groupedFeeds: Record<string, Feed[]> = {};
  feeds.forEach((feed) => {
    const folder = feed.folder || 'Feeds';
    if (!groupedFeeds[folder]) groupedFeeds[folder] = [];
    groupedFeeds[folder].push(feed);
  });

  // Extract and count unique tags, filtering out meta tags
  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    feeds.forEach((f) => {
      if (Array.isArray(f.tags)) {
        f.tags.forEach((t) => {
          if (!isMetaTag(t)) {
            const formatted = formatTag(t);
            if (formatted) {
              counts.set(formatted, (counts.get(formatted) || 0) + 1);
            }
          }
        });
      }
    });
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [feeds]);

  const [showAllTags, setShowAllTags] = useState(false);
  const displayedTags = showAllTags ? tagStats : tagStats.slice(0, 5);

  const isSmartActive = (type: SmartFilter['type']) =>
    activeFilter.type === type;

  const isFeedActive = (feedId: string) =>
    activeFilter.type === 'feed' && activeFilter.id === feedId;

  const isFolderActive = (folderName: string) =>
    activeFilter.type === 'folder' && activeFilter.id === folderName;

  return (
    <aside
      className={`${
        isMobile ? 'w-full' : 'w-full md:w-72 lg:w-80'
      } bg-black flex flex-col h-full border-r border-white/[0.08] shrink-0 select-none relative overflow-hidden`}
    >
      {/* Large Native Title Header */}
      <div className="ios-header-safe pt-6 pb-4 px-4 bg-black shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Feeds</h1>
            <p className="text-xs text-[#8E8E93] mt-0.5">Updated Just Now</p>
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallGuide />
            <button
              onClick={() => {
                onRefreshAll();
              }}
              disabled={isRefreshing}
              className="p-2 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] rounded-xl transition disabled:opacity-50"
              title="Refresh All Feeds"
            >
              <RefreshCw className={`w-4 h-4 stroke-[1.5] ${isRefreshing ? 'animate-spin text-[#0A84FF]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Inset Grouped Navigation */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pt-2 pb-[calc(84px+max(16px,env(safe-area-inset-bottom,16px)))] space-y-4 text-xs font-medium overscroll-y-contain">
        
        {/* Prominent AI Brief Card (Above Today & All Unread) */}
        {onGenerateBriefing && (
          <AIBriefCard
            briefing={aiBriefing ?? null}
            isLoading={isGeneratingBriefing ?? false}
            isExpanded={isBriefingExpanded ?? true}
            unreadCount={totalUnreadCount}
            onGenerate={onGenerateBriefing}
            onToggleCollapse={onToggleBriefingCollapse ?? (() => {})}
            onDismiss={onDismissBriefing ?? (() => {})}
            variant="sidebar"
          />
        )}

        {/* Smart Feeds Inset Group Card */}
        <div className="bg-[#1C1C1E] rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm">
          <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between text-[13px] font-bold text-[#8E8E93] uppercase tracking-wider">
            <span>Smart Feeds</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {/* Today */}
            <button
              onClick={() => {
                onSelectFilter({ type: 'today', title: 'Today' });
              }}
              className={`w-full flex items-center justify-between px-3.5 min-h-[44px] transition text-left ${
                isSmartActive('today') ? 'bg-[#0A84FF] text-white font-semibold' : 'text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Calendar className={`w-4 h-4 stroke-[1.5] ${isSmartActive('today') ? 'text-white' : 'text-[#8E8E93]'}`} />
                <span>Today</span>
              </div>
              <span className={`text-xs font-normal ${isSmartActive('today') ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                {todayCount > 0 ? todayCount : ''}
              </span>
            </button>

            {/* All Unread */}
            <button
              onClick={() => {
                onSelectFilter({ type: 'unread', title: 'All Unread' });
              }}
              className={`w-full flex items-center justify-between px-3.5 min-h-[44px] transition text-left ${
                isSmartActive('unread') ? 'bg-[#0A84FF] text-white font-semibold' : 'text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <CircleDot className={`w-4 h-4 stroke-[1.5] ${isSmartActive('unread') ? 'text-white' : 'text-[#8E8E93]'}`} />
                <span>All Unread</span>
              </div>
              <span className={`text-xs font-normal ${isSmartActive('unread') ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                {totalUnreadCount > 0 ? totalUnreadCount : ''}
              </span>
            </button>

            {/* Starred */}
            <button
              onClick={() => {
                onSelectFilter({ type: 'starred', title: 'Starred' });
              }}
              className={`w-full flex items-center justify-between px-3.5 min-h-[44px] transition text-left ${
                isSmartActive('starred') ? 'bg-[#0A84FF] text-white font-semibold' : 'text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Star className={`w-4 h-4 stroke-[1.5] ${isSmartActive('starred') ? 'text-white fill-white' : 'text-[#8E8E93]'}`} />
                <span>Starred</span>
              </div>
              <span className={`text-xs font-normal ${isSmartActive('starred') ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                {starredCount > 0 ? starredCount : ''}
              </span>
            </button>

            {/* Archive */}
            <button
              onClick={() => {
                onSelectFilter({ type: 'archive', title: 'Archive' });
              }}
              className={`w-full flex items-center justify-between px-3.5 min-h-[44px] transition text-left ${
                isSmartActive('archive') ? 'bg-[#0A84FF] text-white font-semibold' : 'text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Archive className={`w-4 h-4 stroke-[1.5] ${isSmartActive('archive') ? 'text-white' : 'text-[#8E8E93]'}`} />
                <span>Archive</span>
              </div>
              <span className={`text-xs font-normal ${isSmartActive('archive') ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                {archivedCount > 0 ? archivedCount : ''}
              </span>
            </button>
          </div>
        </div>

        {/* iCloud Feeds / Folders Inset Group Card */}
        <div className="bg-[#1C1C1E] rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm">
          <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between text-[13px] font-bold text-[#8E8E93] uppercase tracking-wider">
            <span>Subscriptions</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {Object.entries(groupedFeeds).map(([folderName, folderFeeds]) => {
              const isCollapsed = collapsedFolders[folderName];
              const folderUnread = folderFeeds.reduce(
                (sum, f) => sum + (unreadCountByFeed[f.id] || 0),
                0
              );
              const folderActive = isFolderActive(folderName);

              return (
                <div key={folderName} className="flex flex-col">
                  {/* Folder Header Row */}
                  <div
                    className={`w-full flex items-center min-h-[44px] transition ${
                      folderActive ? 'bg-[#0A84FF] text-white' : 'text-slate-100 hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFolder(folderName)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${folderName}`}
                      className={`pl-3 pr-1.5 min-h-[44px] flex items-center shrink-0 transition ${
                        folderActive ? 'text-white/90 hover:text-white' : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 stroke-[1.5]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 stroke-[1.5]" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectFilter({ type: 'folder', id: folderName, title: folderName })}
                      className="flex items-center gap-2.5 truncate flex-1 min-h-[44px] pr-2 text-left"
                    >
                      <FolderOpen className={`w-4 h-4 stroke-[1.5] shrink-0 ${folderActive ? 'text-white' : 'text-[#0A84FF]'}`} />
                      <span className="font-semibold truncate">{folderName}</span>
                    </button>
                    <span className={`text-xs font-normal pr-3.5 pl-1 shrink-0 ${folderActive ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                      {folderUnread > 0 ? folderUnread : ''}
                    </span>
                  </div>

                  {/* Folder Feeds List */}
                  {!isCollapsed && (
                    <FolderFeedsList
                      folderFeeds={folderFeeds}
                      activeFilter={activeFilter}
                      unreadCountByFeed={unreadCountByFeed}
                      onSelectFilter={onSelectFilter}
                      isFeedActive={isFeedActive}
                      onOpenFeedMenu={setFeedActionTarget}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Topics / Tags Inset Group Card */}
        {tagStats.length > 0 && (
          <div className="bg-[#1C1C1E] rounded-2xl border border-white/[0.08] p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between text-[13px] font-bold text-[#8E8E93] uppercase tracking-wider">
              <span>Topics</span>
              {tagStats.length > 5 && (
                <button
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="text-[11px] text-[#0A84FF] hover:underline normal-case transition"
                >
                  {showAllTags ? 'Show less' : `+${tagStats.length - 5} more`}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {displayedTags.map(({ tag, count }) => {
                const isActive = activeFilter.type === 'tag' && activeFilter.id === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      onSelectFilter({ type: 'tag', id: tag, title: tag });
                    }}
                    className={`px-3 py-1 rounded-md text-xs transition flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#0A84FF] text-white font-semibold shadow-sm'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-300'
                    }`}
                  >
                    <span>{tag}</span>
                    <span className="text-[10px] text-[#8E8E93]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Floating Bottom Navigation Bar (Fixed at bottom with proper z-index and backdrop blur) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 py-3 pb-[max(14px,env(safe-area-inset-bottom,14px))] bg-black/85 backdrop-blur-[20px] border-t border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2 bg-[#1C1C1E]/90 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 shadow-2xl">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 text-slate-200 hover:text-white transition py-0.5"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4 text-[#0A84FF] stroke-[1.5]" />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>

        <button
          onClick={() => {
            onOpenAddFeed();
          }}
          className="w-12 h-12 rounded-full bg-[#0A84FF] text-white flex items-center justify-center shadow-2xl active:scale-95 transition"
          title="Add Feed"
        >
          <Plus className="w-6 h-6 stroke-[2]" />
        </button>
      </div>

      {/* iOS-Style Long-Press Feed Action Sheet */}
      {feedActionTarget && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setFeedActionTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[#1C1C1E] border border-white/10 p-4 shadow-2xl text-slate-100 space-y-3 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-2 pb-1 border-b border-white/[0.08]">
              <span className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider block mb-1">
                Subscription Options
              </span>
              <h4 className="text-sm font-bold text-white truncate">
                {feedActionTarget.title}
              </h4>
              <p className="text-[11px] text-[#8E8E93] truncate mt-0.5 font-mono">
                {feedActionTarget.url}
              </p>
            </div>

            <div className="space-y-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteFeed(feedActionTarget);
                  setFeedActionTarget(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition"
              >
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Unsubscribe / Delete Feed</div>
                  <div className="text-[10px] text-rose-400/70">Remove this feed and its articles</div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFeedActionTarget(null)}
              className="w-full py-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 font-semibold text-xs transition"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Feed unsubscribe confirmation */}
      <ConfirmDialog
        isOpen={confirmDeleteFeed !== null}
        title="Unsubscribe from feed?"
        message={`This removes "${confirmDeleteFeed?.title ?? ''}" and its articles from your library. You can add it again later.`}
        confirmLabel="Unsubscribe"
        destructive
        onCancel={() => setConfirmDeleteFeed(null)}
        onConfirm={() => {
          if (confirmDeleteFeed && onDeleteFeed) onDeleteFeed(confirmDeleteFeed.id);
          setConfirmDeleteFeed(null);
        }}
      />
    </aside>
  );
};
