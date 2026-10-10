/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Trash2,
  Archive,
  Star,
  CheckCircle,
  MoreHorizontal,
  X,
  ExternalLink,
  ArchiveRestore,
  Pencil
} from 'lucide-react';
import { Article } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { formatTag, isMetaTag } from '../utils/tagUtils';

interface SwipeableArticleCardProps {
  article: Article;
  isSelected: boolean;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  tags: string[];
  formatRelativeTime: (dateStr: string) => string;
  onSelect: () => void;
  onToggleStar: (articleId: string, e?: React.MouseEvent) => void;
  onDelete: (articleId: string) => void;
  onArchive: (articleId: string) => void;
  onUnarchive?: (articleId: string) => void;
  onToggleRead: (articleId: string) => void;
  onUpdateArticle?: (updatedArticle: Article) => void;
  onPointerDown?: (e: React.PointerEvent | React.TouchEvent) => void;
  style?: React.CSSProperties;
  refCallback?: (node: HTMLElement | null) => void;
}

const ACTION_TRAY_WIDTH = 225; // 75px per action button * 3
const LONG_PRESS_THRESHOLD = 450; // ms

export const SwipeableArticleCard: React.FC<SwipeableArticleCardProps> = ({
  article,
  isSelected,
  isRead,
  isStarred,
  isArchived,
  tags,
  formatRelativeTime,
  onSelect,
  onToggleStar,
  onDelete,
  onArchive,
  onUnarchive,
  onToggleRead,
  onUpdateArticle,
  onPointerDown,
  style,
  refCallback
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [showLongPressSheet, setShowLongPressSheet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [editTitle, setEditTitle] = useState(article.title);
  const [editFeedTitle, setEditFeedTitle] = useState(article.feedTitle);
  const [editAuthor, setEditAuthor] = useState(article.author || '');
  const [editSnippet, setEditSnippet] = useState(article.snippet || '');

  useEffect(() => {
    setEditTitle(article.title);
    setEditFeedTitle(article.feedTitle);
    setEditAuthor(article.author || '');
    setEditSnippet(article.snippet || '');
  }, [article]);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    startXRef.current = clientX;
    startYRef.current = clientY;
    currentXRef.current = clientX;
    isDraggingRef.current = true;
    hasMovedRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      if (!hasMovedRef.current) {
        triggerHaptic('heavy');
        setShowLongPressSheet(true);
        isDraggingRef.current = false;
      }
    }, LONG_PRESS_THRESHOLD);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (Math.hypot(deltaX, deltaY) > 8) {
      hasMovedRef.current = true;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      const baseOffset = isOpen ? -ACTION_TRAY_WIDTH : 0;
      let newOffset = baseOffset + deltaX;

      if (newOffset > 0) newOffset = 0;
      if (newOffset < -ACTION_TRAY_WIDTH - 60) {
        newOffset = -ACTION_TRAY_WIDTH - 60 + (newOffset + ACTION_TRAY_WIDTH + 60) * 0.2;
      }

      setOffsetX(newOffset);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (offsetX < -ACTION_TRAY_WIDTH - 20) {
      triggerHaptic('error');
      setOffsetX(0);
      setIsOpen(false);
      onDelete(article.id);
      return;
    }

    if (offsetX < -60) {
      triggerHaptic('light');
      setOffsetX(-ACTION_TRAY_WIDTH);
      setIsOpen(true);
    } else {
      setOffsetX(0);
      setIsOpen(false);
    }
  };

  const handleClickCard = () => {
    if (hasMovedRef.current) return;
    if (isOpen) {
      triggerHaptic('light');
      setOffsetX(0);
      setIsOpen(false);
      return;
    }
    triggerHaptic('selection');
    onSelect();
  };

  return (
    <div
      ref={refCallback}
      onPointerDown={onPointerDown}
      style={style}
      className="relative overflow-hidden border-b border-white/[0.08] select-none bg-black"
    >
      {/* Background Action Tray (iOS standard full-height action slots) */}
      <div
        className="absolute inset-y-0 right-0 w-[225px] flex items-stretch z-0 bg-black select-none pointer-events-auto"
        aria-label="Swipe actions"
      >
        {/* Favourite Button (iOS Blue #0A84FF) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(article.id, e);
            setOffsetX(0);
            setIsOpen(false);
          }}
          className="flex-1 min-w-[75px] bg-[#0A84FF] hover:bg-[#0071E3] active:bg-[#0060C0] text-white flex flex-col items-center justify-center py-2 px-1 gap-1.5 transition select-none cursor-pointer"
          title={isStarred ? 'Unstar' : 'Star'}
        >
          <Star className={`w-5 h-5 shrink-0 stroke-[1.75] ${isStarred ? 'fill-white text-white' : 'text-white'}`} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-center leading-none">
            {isStarred ? 'Starred' : 'Star'}
          </span>
        </button>

        {/* Archive Button (iOS System Neutral Gray #2C2C2E) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isArchived && onUnarchive) {
              onUnarchive(article.id);
            } else {
              onArchive(article.id);
            }
            setOffsetX(0);
            setIsOpen(false);
          }}
          className="flex-1 min-w-[75px] bg-[#2C2C2E] hover:bg-[#3A3A3C] active:bg-[#1C1C1E] text-white flex flex-col items-center justify-center py-2 px-1 gap-1.5 transition select-none cursor-pointer border-l border-r border-black/30"
          title={isArchived ? 'Unarchive' : 'Archive'}
        >
          {isArchived ? (
            <ArchiveRestore className="w-5 h-5 shrink-0 stroke-[1.75] text-white" />
          ) : (
            <Archive className="w-5 h-5 shrink-0 stroke-[1.75] text-white" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-center leading-none">
            {isArchived ? 'Restore' : 'Archive'}
          </span>
        </button>

        {/* Delete Button (iOS Destructive Red #FF453A) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOffsetX(0);
            setIsOpen(false);
            onDelete(article.id);
          }}
          className="flex-1 min-w-[75px] bg-[#FF453A] hover:bg-[#E0382E] active:bg-[#C92A21] text-white flex flex-col items-center justify-center py-2 px-1 gap-1.5 transition select-none cursor-pointer"
          title="Delete entry"
        >
          <Trash2 className="w-5 h-5 shrink-0 stroke-[1.75] text-white" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-center leading-none">
            Delete
          </span>
        </button>
      </div>

      {/* Front Article Card Surface (Fully opaque background #1C1C1E prevents bleed-through) */}
      <div
        onClick={handleClickCard}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className={`relative z-10 p-3.5 cursor-pointer flex gap-3 transition-colors bg-[#1C1C1E] ${
          isSelected
            ? 'border-l-4 border-[#0A84FF] bg-[#262629]'
            : 'hover:bg-[#242426]'
        }`}
      >
        {/* Unread indicator dot */}
        <div className="pt-1 shrink-0">
          {!isRead ? (
            <div className="w-2.5 h-2.5 rounded-full bg-[#0A84FF] ring-2 ring-[#0A84FF]/20 shadow-sm" />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-transparent" />
          )}
        </div>

        {/* Article Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] text-[#8E8E93] mb-1">
            <span className="font-semibold text-slate-300 truncate pr-2">
              {article.feedTitle}
            </span>
            <span className="shrink-0 font-mono text-[10px]">
              {formatRelativeTime(article.pubDate)}
            </span>
          </div>

          <h3
            className={`text-xs line-clamp-2 leading-snug mb-1 ${
              isRead ? 'text-slate-300 font-normal' : 'text-slate-100 font-semibold'
            }`}
          >
            {article.title}
          </h3>

          {article.snippet && article.snippet.trim() !== article.title.trim() && !article.snippet.toLowerCase().startsWith(article.title.toLowerCase().slice(0, 30)) && (
            <p className="text-[11px] text-[#8E8E93] line-clamp-2 leading-relaxed">
              {article.snippet}
            </p>
          )}

          {/* Tags */}
          {(() => {
            const validTags = tags.filter((t) => !isMetaTag(t)).map((t) => formatTag(t)).filter(Boolean);
            if (validTags.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {validTags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#8E8E93] font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Right side: Star & Thumbnail */}
        <div className="flex flex-col items-end justify-between shrink-0 ml-1">
          <div className="flex items-center gap-1">
            {isArchived && (
              <span title="Archived" className="text-[#0A84FF] p-0.5">
                <Archive className="w-3 h-3 stroke-[1.5]" />
              </span>
            )}
            <button
              type="button"
              onClick={(e) => onToggleStar(article.id, e)}
              className={`p-1 rounded transition ${
                isStarred
                  ? 'text-[#0A84FF] hover:text-[#0A84FF]/80'
                  : 'text-[#8E8E93] hover:text-white opacity-40 group-hover:opacity-100'
              }`}
            >
              <Star className={`w-3.5 h-3.5 stroke-[1.5] ${isStarred ? 'fill-[#0A84FF]' : ''}`} />
            </button>
          </div>

          {article.imageUrl && (
            <img
              src={article.imageUrl}
              alt=""
              className="w-12 h-12 rounded-lg object-cover bg-black border border-white/[0.08] mt-2"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
        </div>
      </div>

      {/* iOS-Style Long-Press Action Sheet */}
      {showLongPressSheet && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 ios-footer-safe animate-in fade-in duration-150"
          onClick={() => setShowLongPressSheet(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[#1C1C1E] border border-white/10 p-4 shadow-2xl text-slate-100 space-y-3 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-2 pb-1 border-b border-white/[0.08]">
              <span className="text-[10px] text-[#0A84FF] font-semibold uppercase tracking-wider block mb-1">
                {article.feedTitle}
              </span>
              <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                {article.title}
              </h4>
            </div>

            <div className="space-y-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowLongPressSheet(false);
                  onDelete(article.id);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition"
              >
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <Trash2 className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Delete Entry</div>
                  <div className="text-[10px] text-rose-400/70">Permanently remove from reading timeline</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowLongPressSheet(false);
                  setIsEditing(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition"
              >
                <div className="p-1.5 rounded-lg bg-white/[0.08] text-[#0A84FF]">
                  <Pencil className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Edit Entry & Podcast Title</div>
                  <div className="text-[10px] text-[#8E8E93]">Modify title, podcast name, author & snippet</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowLongPressSheet(false);
                  if (isArchived && onUnarchive) {
                    onUnarchive(article.id);
                  } else {
                    onArchive(article.id);
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition"
              >
                <div className="p-1.5 rounded-lg bg-white/[0.08] text-[#0A84FF]">
                  {isArchived ? <ArchiveRestore className="w-4 h-4 stroke-[1.5]" /> : <Archive className="w-4 h-4 stroke-[1.5]" />}
                </div>
                <div className="text-left">
                  <div className="font-semibold">{isArchived ? 'Unarchive Entry' : 'Archive Entry'}</div>
                  <div className="text-[10px] text-[#8E8E93]">Move to Archive without deleting</div>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  triggerHaptic();
                  setShowLongPressSheet(false);
                  onToggleStar(article.id, e);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition"
              >
                <div className="p-1.5 rounded-lg bg-white/[0.08] text-[#0A84FF]">
                  <Star className={`w-4 h-4 stroke-[1.5] ${isStarred ? 'fill-[#0A84FF]' : ''}`} />
                </div>
                <div className="text-left">
                  <div className="font-semibold">{isStarred ? 'Remove from Favourites' : 'Mark as Favourite'}</div>
                  <div className="text-[10px] text-[#8E8E93]">Save to Starred articles</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowLongPressSheet(false);
                  onToggleRead(article.id);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-slate-200 hover:text-white transition"
              >
                <div className="p-1.5 rounded-lg bg-white/[0.08] text-[#8E8E93]">
                  <CheckCircle className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">{isRead ? 'Mark as Unread' : 'Mark as Read'}</div>
                  <div className="text-[10px] text-[#8E8E93]">Toggle unread status</div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowLongPressSheet(false)}
              className="w-full py-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 font-semibold text-xs transition"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Entry Modal */}
      {isEditing && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ios-header-safe ios-footer-safe animate-in fade-in duration-150"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#1C1C1E] border border-white/10 p-5 shadow-2xl text-slate-100 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-[#0A84FF] stroke-[1.5]" />
                  Edit Entry & Podcast Title
                </h3>
                <p className="text-[11px] text-[#8E8E93] mt-0.5">Customize entry title, podcast name, author and summary</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-xl text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Podcast / Feed Title</label>
                <input
                  type="text"
                  value={editFeedTitle}
                  onChange={(e) => setEditFeedTitle(e.target.value)}
                  placeholder="e.g. Accidental Tech Podcast"
                  className="w-full bg-black border border-white/[0.08] rounded-xl px-3 py-2 text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#0A84FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Entry / Episode Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Episode 540: We Are Not Ready"
                  className="w-full bg-black border border-white/[0.08] rounded-xl px-3 py-2 text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#0A84FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Author / Host</label>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  placeholder="e.g. Marco Arment"
                  className="w-full bg-black border border-white/[0.08] rounded-xl px-3 py-2 text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#0A84FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Summary / Snippet</label>
                <textarea
                  value={editSnippet}
                  onChange={(e) => setEditSnippet(e.target.value)}
                  rows={3}
                  placeholder="Summary or show notes..."
                  className="w-full bg-black border border-white/[0.08] rounded-xl px-3 py-2 text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#0A84FF] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  if (onUpdateArticle) {
                    onUpdateArticle({
                      ...article,
                      title: editTitle.trim() || article.title,
                      feedTitle: editFeedTitle.trim() || article.feedTitle,
                      author: editAuthor.trim(),
                      snippet: editSnippet.trim()
                    });
                  }
                  setIsEditing(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white font-bold transition shadow-lg shadow-[#0A84FF]/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
