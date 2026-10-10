/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle,
  Sliders,
  Share2
} from 'lucide-react';

interface MobileReaderBarProps {
  hasPrevArticle: boolean;
  hasNextArticle: boolean;
  onPrevArticle: () => void;
  onNextArticle: () => void;
  isStarred: boolean;
  isRead: boolean;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onOpenFormatSheet?: () => void;
  onShare: () => void;
}

export const MobileReaderBar: React.FC<MobileReaderBarProps> = ({
  hasPrevArticle,
  hasNextArticle,
  onPrevArticle,
  onNextArticle,
  isStarred,
  isRead,
  onToggleStar,
  onToggleRead,
  onShare
}) => {
  return (
    <nav
      aria-label="Article navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/[0.08] pb-[max(14px,env(safe-area-inset-bottom,14px))] pt-2.5 px-4 shadow-2xl shadow-black/80"
    >
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Previous Article Button */}
        <button
          onClick={() => {
            onPrevArticle();
          }}
          disabled={!hasPrevArticle}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition ${
            hasPrevArticle
              ? 'text-slate-300 active:text-white active:bg-slate-800/80 active:scale-95'
              : 'text-slate-700 cursor-not-allowed opacity-40'
          }`}
          aria-label="Previous article"
          title="Previous article"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Favorite / Star Button */}
        <button
          onClick={() => {
            onToggleStar();
          }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition active:scale-95 active:bg-slate-800/80"
          aria-label={isStarred ? 'Unstar article' : 'Star article'}
          title={isStarred ? 'Starred' : 'Star article'}
        >
          <Star
            className={`w-5 h-5 transition-transform ${
              isStarred ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-400'
            }`}
          />
        </button>

        {/* Read / Unread Toggle Button */}
        <button
          onClick={() => {
            onToggleRead();
          }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition active:scale-95 active:bg-slate-800/80"
          aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
          title={isRead ? 'Read' : 'Unread'}
        >
          <CheckCircle
            className={`w-5 h-5 transition-transform ${
              isRead ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-400'
            }`}
          />
        </button>

        {/* Share Button */}
        <button
          onClick={() => {
            onShare();
          }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 active:text-white active:bg-slate-800/80 active:scale-95 transition"
          aria-label="Share article"
          title="Share link"
        >
          <Share2 className="w-5 h-5" />
        </button>

        {/* Next Article Button */}
        <button
          onClick={() => {
            onNextArticle();
          }}
          disabled={!hasNextArticle}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition ${
            hasNextArticle
              ? 'text-slate-300 active:text-white active:bg-slate-800/80 active:scale-95'
              : 'text-slate-700 cursor-not-allowed opacity-40'
          }`}
          aria-label="Next article"
          title="Next article"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </nav>
  );
};
