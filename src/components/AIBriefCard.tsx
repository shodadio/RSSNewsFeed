/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Layers,
  Tags,
  ListOrdered,
  ExternalLink
} from 'lucide-react';
import { AIBriefing, AIBriefingStory } from '../types';

interface AIBriefCardProps {
  briefing: AIBriefing | null;
  isLoading: boolean;
  isExpanded: boolean;
  unreadCount: number;
  onGenerate: () => void;
  onToggleCollapse: () => void;
  onDismiss: () => void;
  onSelectStory?: (story: AIBriefingStory) => void;
  variant?: 'sidebar' | 'timeline';
  className?: string;
}

/** Compact relative time for the digest header and story rows. */
function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Stories shown before the sidebar card's own "Show all" expander kicks in. */
const SIDEBAR_STORY_PREVIEW = 5;

export const AIBriefCard: React.FC<AIBriefCardProps> = ({
  briefing,
  isLoading,
  isExpanded,
  unreadCount,
  onGenerate,
  onToggleCollapse,
  onDismiss,
  onSelectStory,
  variant = 'sidebar',
  className = ''
}) => {
  const [showAllStories, setShowAllStories] = useState(false);

  // If loading, show iOS-styled elevated card with inline spinner and shimmering pulse
  if (isLoading) {
    return (
      <div
        className={`bg-[#1C1C1E] rounded-2xl border border-white/[0.12] p-4 shadow-sm select-none animate-pulse ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0A84FF]/20 flex items-center justify-center text-[#0A84FF]">
              <Sparkles className="w-4 h-4 stroke-[1.75] animate-spin" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Building today's digest...</span>
              </div>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                Ranking {unreadCount} {unreadCount === 1 ? 'story' : 'stories'} and finding the through-line
              </p>
            </div>
          </div>
          <RefreshCw className="w-4 h-4 text-[#0A84FF] animate-spin stroke-[1.5]" />
        </div>

        {/* Shimmering skeleton lines */}
        <div className="mt-3.5 space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="h-2.5 bg-white/[0.08] rounded-full w-full"></div>
          <div className="h-2.5 bg-white/[0.08] rounded-full w-4/5"></div>
          <div className="h-2 bg-white/[0.05] rounded-full w-3/5 mt-2"></div>
        </div>
      </div>
    );
  }

  // If no digest yet, show the idle action surface
  if (!briefing) {
    return (
      <div
        className={`bg-[#1C1C1E] rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm hover:border-[#0A84FF]/40 transition group select-none ${className}`}
      >
        <button
          onClick={() => {
            onGenerate();
          }}
          disabled={unreadCount === 0}
          className="w-full p-3.5 flex items-center justify-between text-left transition hover:bg-white/[0.02] active:bg-white/[0.06] disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0A84FF]/25 to-purple-500/20 border border-white/[0.1] flex items-center justify-center text-[#0A84FF] shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-tight">Morning Digest</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#0A84FF]/15 text-[#0A84FF] font-medium border border-[#0A84FF]/20">
                  Gemini
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E93] truncate mt-0.5">
                {unreadCount > 0
                  ? `Top 10, key themes and the day in a paragraph from ${unreadCount} unread ${
                      unreadCount === 1 ? 'story' : 'stories'
                    }`
                  : 'All caught up (0 unread)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span className="text-xs font-semibold text-[#0A84FF] group-hover:underline">
              {unreadCount > 0 ? 'Generate' : 'Up to date'}
            </span>
          </div>
        </button>
      </div>
    );
  }

  const stories = briefing.topStories || [];
  const themes = briefing.themes || [];
  const isTimeline = variant === 'timeline';
  const visibleStories =
    isTimeline || showAllStories ? stories : stories.slice(0, SIDEBAR_STORY_PREVIEW);
  const hiddenStoryCount = stories.length - visibleStories.length;
  const isFallback = briefing.source === 'fallback';

  return (
    <div
      className={`bg-[#1C1C1E] rounded-2xl border border-white/[0.1] overflow-hidden shadow-lg select-none transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="p-3.5 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#0A84FF]/20 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF] shrink-0">
            <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-tight">Morning Digest</h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#8E8E93] font-mono">
                {stories.length || briefing.articlesCount} {stories.length === 1 ? 'story' : 'stories'}
              </span>
            </div>
            <p className="text-[10px] text-[#8E8E93] mt-0.5 truncate">
              {briefing.poweredBy || 'AI Synthesizer'}
              {isFallback ? ' - recurring keywords, no API key' : ''} - {timeAgo(briefing.generatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Regenerate */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerate();
            }}
            className="p-1.5 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] rounded-lg transition"
            title="Regenerate today's digest"
            aria-label="Regenerate today's digest"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            onClick={() => {
              onToggleCollapse();
            }}
            className="p-1.5 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] rounded-lg transition"
            title={isExpanded ? 'Collapse digest' : 'Expand digest'}
            aria-label={isExpanded ? 'Collapse digest' : 'Expand digest'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 stroke-[1.5]" />
            ) : (
              <ChevronDown className="w-4 h-4 stroke-[1.5]" />
            )}
          </button>

          {/* Dismiss */}
          <button
            onClick={() => {
              onDismiss();
            }}
            className="p-1.5 text-[#8E8E93] hover:text-rose-400 hover:bg-white/[0.08] rounded-lg transition"
            title="Dismiss for today"
            aria-label="Dismiss for today"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 text-left">
          {/* The day in one paragraph */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5">
              <Layers className="w-3 h-3 stroke-[1.5] text-[#0A84FF]" />
              <span>The day in one paragraph</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-200 bg-white/[0.03] p-3 rounded-xl border border-white/[0.04] font-normal selection:bg-[#0A84FF]/40">
              {briefing.paragraph}
            </p>
          </div>

          {/* Key themes */}
          {themes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                <Tags className="w-3 h-3 stroke-[1.5] text-[#0A84FF]" />
                <span>Key themes</span>
              </div>
              <ul className="space-y-1.5">
                {themes.map((theme, idx) => (
                  <li
                    key={`${theme.label}-${idx}`}
                    className="bg-black/40 rounded-xl border border-white/[0.04] px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-white truncate">{theme.label}</span>
                      {typeof theme.storyCount === 'number' && (
                        <span className="text-[10px] text-[#8E8E93] font-mono shrink-0">
                          {theme.storyCount} {theme.storyCount === 1 ? 'story' : 'stories'}
                        </span>
                      )}
                    </div>
                    {theme.description && (
                      <p className="text-[11px] text-[#8E8E93] leading-relaxed mt-0.5">{theme.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top stories */}
          {stories.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <ListOrdered className="w-3 h-3 stroke-[1.5] text-[#0A84FF]" />
                  <span>Top {stories.length} stories</span>
                </span>
                <span className="text-[10px] lowercase text-[#8E8E93]/70 font-normal">
                  {isFallback ? 'newest unread' : 'ranked by significance'}
                </span>
              </div>
              <ol className="space-y-2">
                {visibleStories.map((story, idx) => (
                  <li key={story.id || `${story.title}-${idx}`}>
                    <button
                      onClick={() => onSelectStory?.(story)}
                      className="w-full text-left flex items-start gap-2.5 bg-black/40 hover:bg-white/[0.04] active:bg-white/[0.06] p-2.5 rounded-xl border border-white/[0.04] transition group"
                    >
                      <span className="w-5 h-5 rounded-md bg-[#0A84FF]/15 border border-[#0A84FF]/20 text-[#0A84FF] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <strong className="font-semibold text-white text-[12px] leading-snug">
                            {story.title}
                          </strong>
                          <ExternalLink className="w-3 h-3 stroke-[1.5] text-[#8E8E93] group-hover:text-[#0A84FF] shrink-0 mt-0.5" />
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] text-[#8E8E93] font-mono mt-1">
                          {story.feedTitle && <span className="truncate max-w-[130px]">{story.feedTitle}</span>}
                          {story.feedTitle && story.pubDate && <span className="opacity-50">|</span>}
                          {story.pubDate && <span className="shrink-0">{timeAgo(story.pubDate)}</span>}
                        </span>
                        {story.whyItMatters && (
                          <span className="block text-[11px] text-slate-300 leading-relaxed mt-1">
                            {story.whyItMatters}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

              {/* Sidebar card keeps the list short so the navigation stays readable */}
              {!isTimeline && hiddenStoryCount > 0 && (
                <button
                  onClick={() => setShowAllStories(true)}
                  className="mt-2 w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-semibold text-[#0A84FF] transition"
                >
                  Show {hiddenStoryCount} more
                </button>
              )}
              {!isTimeline && showAllStories && stories.length > SIDEBAR_STORY_PREVIEW && (
                <button
                  onClick={() => setShowAllStories(false)}
                  className="mt-2 w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-semibold text-[#8E8E93] transition"
                >
                  Show fewer
                </button>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#8E8E93]">
            <button
              onClick={() => {
                onToggleCollapse();
              }}
              className="text-[#0A84FF] hover:underline font-semibold"
            >
              Collapse view
            </button>
            <button
              onClick={() => {
                onDismiss();
              }}
              className="text-[#8E8E93] hover:text-white transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
