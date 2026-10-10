/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Layers,
  ExternalLink
} from 'lucide-react';
import { AIBriefing } from '../types';

interface AIBriefCardProps {
  briefing: AIBriefing | null;
  isLoading: boolean;
  isExpanded: boolean;
  unreadCount: number;
  onGenerate: () => void;
  onToggleCollapse: () => void;
  onDismiss: () => void;
  variant?: 'sidebar' | 'timeline';
  className?: string;
}

export const AIBriefCard: React.FC<AIBriefCardProps> = ({
  briefing,
  isLoading,
  isExpanded,
  unreadCount,
  onGenerate,
  onToggleCollapse,
  onDismiss,
  variant = 'sidebar',
  className = ''
}) => {
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
                <span>Synthesizing Unread Brief...</span>
              </div>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                Analyzing {unreadCount} stories with Gemini 3.8
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

  // If no briefing yet, show prominent action button / card
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
                <span className="text-xs font-bold text-white tracking-tight">AI Brief</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#0A84FF]/15 text-[#0A84FF] font-medium border border-[#0A84FF]/20">
                  Gemini
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E93] truncate mt-0.5">
                {unreadCount > 0
                  ? `Synthesize ${unreadCount} unread ${unreadCount === 1 ? 'item' : 'items'}`
                  : 'All caught up (0 unread)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span className="text-xs font-semibold text-[#0A84FF] group-hover:underline">
              {unreadCount > 0 ? 'Summarize' : 'Up to date'}
            </span>
          </div>
        </button>
      </div>
    );
  }

  // When briefing is ready: Render collapsible summary card
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
              <h3 className="text-xs font-bold text-white tracking-tight">Executive Briefing</h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#8E8E93] font-mono">
                {briefing.articlesCount} stories
              </span>
            </div>
            <p className="text-[10px] text-[#8E8E93] mt-0.5">
              {briefing.poweredBy || 'AI Synthesizer'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Re-generate */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerate();
            }}
            className="p-1.5 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] rounded-lg transition"
            title="Re-synthesize unread stories"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            onClick={() => {
              onToggleCollapse();
            }}
            className="p-1.5 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] rounded-lg transition"
            title={isExpanded ? 'Collapse Brief' : 'Expand Brief'}
            aria-label={isExpanded ? 'Collapse Brief' : 'Expand Brief'}
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
            title="Dismiss Brief"
            aria-label="Dismiss Brief"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 text-left">
          {/* Executive Summary */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5">
              <Layers className="w-3 h-3 stroke-[1.5] text-[#0A84FF]" />
              <span>Executive Summary</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-200 bg-white/[0.03] p-3 rounded-xl border border-white/[0.04] font-normal selection:bg-[#0A84FF]/40">
              {briefing.executiveSummary}
            </p>
          </div>

          {/* Key Bullet Points */}
          {briefing.bulletPoints && briefing.bulletPoints.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                <span>Key Bullet Points</span>
                <span className="text-[10px] lowercase text-[#8E8E93]/70 font-normal">
                  {briefing.bulletPoints.length} items
                </span>
              </div>
              <ul className="space-y-2.5">
                {briefing.bulletPoints.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-300 bg-black/40 p-2.5 rounded-xl border border-white/[0.04]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="font-semibold text-white text-[12px] leading-snug">
                          {item.headline}
                        </strong>
                        {item.feedTitle && (
                          <span className="text-[10px] text-[#8E8E93] truncate shrink-0 max-w-[110px] font-mono">
                            {item.feedTitle}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8E8E93] leading-relaxed mt-1">
                        {item.summary}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
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
