/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ExternalLink,
  Star,
  CheckCircle,
  Share2,
  ChevronLeft,
  BookOpen,
  Type,
  Clock,
  User,
  Sparkles,
  Loader2,
  Volume2,
  Play,
  Pause,
  Square,
  Copy,
  Check,
  X,
  Zap,
  Lock,
  AlertCircle
} from 'lucide-react';
import { Article, ScrapedArticle } from '../types';
import { getAuthHeaders, notifySessionExpired } from '../utils/api';
import { AuthModal } from './AuthModal';
import { MobileReaderBar } from './MobileReaderBar';
import DOMPurify from 'dompurify';

interface ArticleViewProps {
  article: Article | null;
  isStarred: boolean;
  isRead: boolean;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onBackToTimeline?: () => void;
  isMobile: boolean;
  onOpenAuth?: () => void;
  hasPrevArticle?: boolean;
  hasNextArticle?: boolean;
  onPrevArticle?: () => void;
  onNextArticle?: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  isStarred,
  isRead,
  onToggleStar,
  onToggleRead,
  onBackToTimeline,
  isMobile,
  onOpenAuth,
  hasPrevArticle = false,
  hasNextArticle = false,
  onPrevArticle = () => {},
  onNextArticle = () => {}
}) => {
  const [isReaderMode, setIsReaderMode] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedArticle | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(() => {
    return (localStorage.getItem('nnw_font_size') as any) || 'base';
  });

  const handleDecreaseFontSize = () => {
    setFontSize(prev => {
      const next = prev === 'xl' ? 'lg' : prev === 'lg' ? 'base' : prev === 'base' ? 'sm' : 'sm';
      localStorage.setItem('nnw_font_size', next);
      return next;
    });
  };

  const handleIncreaseFontSize = () => {
    setFontSize(prev => {
      const next = prev === 'sm' ? 'base' : prev === 'base' ? 'lg' : prev === 'lg' ? 'xl' : 'xl';
      localStorage.setItem('nnw_font_size', next);
      return next;
    });
  };

  const lineHeight = 'relaxed';
  const margin = 'normal';
  const [showShareToast, setShowShareToast] = useState(false);

  // Read Aloud Speech Synthesis state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // 1-Sentence Gemini Summary state
  const [summariesCache, setSummariesCache] = useState<Record<string, string>>({});
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [showInlineAuth, setShowInlineAuth] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [hasCopiedSummary, setHasCopiedSummary] = useState(false);

  // Swipe right to go back
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    // Edge-swipe right: started within 90px of left edge and moved right by > 50px
    if (touchStartXRef.current < 90 && deltaX > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (onBackToTimeline) {
        onBackToTimeline();
      }
    }
  };

  // Reset reader mode and speech when article changes
  useEffect(() => {
    setIsReaderMode(false);
    setScrapedData(null);
    setScrapeError(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsSummarizing(false);
    setSummaryError(null);
    setHasCopiedSummary(false);
    if (article?.id && summariesCache[article.id]) {
      setShowSummary(true);
    } else {
      setShowSummary(false);
    }
  }, [article?.id]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Candidate hero image URL from scraper or feed enclosure
  const heroBannerUrl = (isReaderMode && scrapedData?.leadImage) || article?.imageUrl || '';

  // Clean, sanitized HTML body (strips noscript duplicate fallback tags and tracking pixels, strictly sanitized via DOMPurify)
  const displayHtml = useMemo(() => {
    if (!article) return '';
    const raw =
      isReaderMode && scrapedData?.contentHtml
        ? scrapedData.contentHtml
        : article.content || `<p>${article.snippet}</p>`;

    // Remove <noscript> blocks which often contain duplicate fallback <img> tags for lazy loading
    let clean = raw.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    // Remove 1x1 tracking pixels
    clean = clean.replace(
      /<img[^>]+(?:width=["']1["']|height=["']1["']|class=["'][^"']*tracker[^"']*["'])[^>]*>/gi,
      ''
    );

    // Strip hardcoded font-size and line-height inline style rules from feeds so reader controls function reliably
    clean = clean.replace(/font-size\s*:\s*[^;"]+;?/gi, '');
    clean = clean.replace(/line-height\s*:\s*[^;"]+;?/gi, '');

    // Sanitize with DOMPurify to eliminate XSS while preserving rich article typography
    const sanitized = DOMPurify.sanitize(clean, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script', 'style', 'object', 'embed', 'applet', 'form', 'input', 'button', 'dialog', 'meta', 'base'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction', 'autofocus'],
      ADD_ATTR: ['target', 'rel']
    });

    return sanitized;
  }, [isReaderMode, scrapedData?.contentHtml, article]);

  // Determine if a separate Lead Image block should be displayed above the article body.
  // CRITICAL: Avoid duplicate renderings! If the article HTML already includes this image
  // or starts with a hero image, do not render a duplicate banner.
  const shouldShowHeroBanner = useMemo(() => {
    if (!heroBannerUrl) return false;
    if (!displayHtml.trim()) return true;

    // Check if the HTML content contains any <img> tags
    const imgMatches = [...displayHtml.matchAll(/<img[^>]+src=["']([^"'>]+)["']/gi)];
    if (imgMatches.length === 0) {
      // Body has no images at all; definitely show the lead image banner!
      return true;
    }

    // Helper to extract clean asset key / filename from an image URL
    const getAssetKey = (u: string): string => {
      try {
        const decoded = decodeURIComponent(u);
        const noQuery = decoded.split('?')[0].split('#')[0];
        const parts = noQuery.split('/');
        const last = parts[parts.length - 1];
        if (last && last.length > 5) return last.toLowerCase();
        return noQuery.toLowerCase();
      } catch {
        return u.toLowerCase();
      }
    };

    const heroKey = getAssetKey(heroBannerUrl);

    // 1. If any <img> tag in the article body matches the hero URL or its core filename/asset ID, do NOT duplicate!
    for (const match of imgMatches) {
      const src = match[1];
      if (!src) continue;
      if (src === heroBannerUrl) return false;
      const srcKey = getAssetKey(src);
      if (srcKey === heroKey) return false;
      if (heroKey.length > 8 && src.toLowerCase().includes(heroKey)) return false;
      if (srcKey.length > 8 && heroBannerUrl.toLowerCase().includes(srcKey)) return false;
    }

    // 2. If the article body already begins with an image near the top (within first 1500 chars),
    // that image serves as the hero image in the article's natural layout.
    const firstImgIndex = displayHtml.search(/<img\b/i);
    if (firstImgIndex !== -1 && firstImgIndex < 1500) {
      return false;
    }

    return true;
  }, [heroBannerUrl, displayHtml]);

  const getPlainText = () => {
    if (!article) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = displayHtml;
    const titleText = article.title || '';
    const bodyText = tempDiv.textContent || tempDiv.innerText || '';
    return `${titleText}. ${bodyText}`;
  };

  const handleStartSpeech = () => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis is not supported in this browser environment.');
      return;
    }

    window.speechSynthesis.cancel();

    const textToRead = getPlainText();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = speechRate;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePauseSpeech = () => {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    }
  };

  const handleResumeSpeech = () => {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      }
    }
  };

  const handleStopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const handleRateChange = (newRate: number) => {
    setSpeechRate(newRate);
    if (isSpeaking && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToRead = getPlainText();
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = newRate;
      utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
      utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleReaderMode = async () => {
    if (!article) return;
    if (isReaderMode) {
      setIsReaderMode(false);
      return;
    }

    setIsReaderMode(true);
    if (!scrapedData) {
      setIsScraping(true);
      setScrapeError(null);
      try {
        const res = await fetch('/api/feeds/scrape-article', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ url: article.link })
        });
        const data = await res.json();
        if (res.ok) {
          setScrapedData(data);
        } else {
          setScrapeError(data.error || 'Failed to scrape full web page.');
        }
      } catch (err: any) {
        setScrapeError('Network error extracting full article body.');
      } finally {
        setIsScraping(false);
      }
    }
  };

  const handleShare = async () => {
    if (!article) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          url: article.link
        });
      } catch {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(article.link);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    }
  };

  const domain = (() => {
    if (!article) return '';
    try {
      return new URL(article.link).hostname.replace(/^www\./, '');
    } catch {
      return article.feedTitle;
    }
  })();

  // Dynamic estimated reading time calculation
  const readingTimeMin = useMemo(() => {
    if (scrapedData?.readingTimeMin) return scrapedData.readingTimeMin;
    if (!article) return 1;
    const text = (article.content || article.snippet || '').replace(/<[^>]+>/g, ' ');
    const words = (text.match(/\b\w+\b/g) || []).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [article, scrapedData]);

  const fontSizeClass = {
    sm: 'text-sm reader-size-sm',
    base: 'text-base reader-size-base',
    lg: 'text-lg reader-size-lg',
    xl: 'text-xl reader-size-xl'
  }[fontSize];

  const lineHeightClass = {
    normal: 'leading-normal reader-leading-normal',
    relaxed: 'leading-relaxed reader-leading-relaxed',
    loose: 'leading-loose reader-leading-loose'
  }[lineHeight];

  const marginClass = {
    compact: 'max-w-xl mx-auto px-3 sm:px-4',
    normal: 'max-w-2xl mx-auto px-4 sm:px-6',
    wide: 'max-w-3xl mx-auto px-5 sm:px-8'
  }[margin];

  const currentSummary = article ? summariesCache[article.id] || null : null;

  const handleSummarizeArticle = async () => {
    if (!article) return;

    // If summary is already cached, toggle visibility
    if (summariesCache[article.id]) {
      setShowSummary((prev) => !prev);
      return;
    }

    setIsSummarizing(true);
    setSummaryError(null);
    setShowSummary(true);

    try {
      const res = await fetch('/api/articles/summarize', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: article.title,
          content: (isReaderMode && scrapedData?.contentHtml) || article.content,
          snippet: article.snippet,
          link: article.link
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthError(true);
          notifySessionExpired('Passcode authentication required.');
        } else {
          setIsAuthError(false);
        }
        throw new Error(data.error || 'Failed to generate 1-sentence summary.');
      }

      setIsAuthError(false);
      setSummariesCache((prev) => ({
        ...prev,
        [article.id]: data.summary
      }));
      setShowSummary(true);
    } catch (err: any) {
      const msg = err.message || 'Failed to generate 1-sentence summary with Gemini.';
      if (
        msg.toLowerCase().includes('passcode') ||
        msg.toLowerCase().includes('unauthorized') ||
        msg.toLowerCase().includes('token')
      ) {
        setIsAuthError(true);
      }
      setSummaryError(msg);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCopySummary = () => {
    if (!currentSummary) return;
    navigator.clipboard.writeText(currentSummary);
    setHasCopiedSummary(true);
    setTimeout(() => setHasCopiedSummary(false), 2000);
  };

  if (!article) {
    return (
      <div className="w-full flex-1 bg-slate-950 flex flex-col h-full overflow-hidden select-none">
        {/* iOS Safe Area Navigation Header for empty state */}
        <div className="ios-header-safe pb-2.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between shrink-0">
          {isMobile && onBackToTimeline ? (
            <button
              onClick={onBackToTimeline}
              className="inline-flex items-center gap-1 py-1.5 px-2.5 -ml-1.5 text-amber-400 hover:text-amber-300 active:bg-slate-800/90 rounded-xl transition font-semibold text-xs touch-manipulation select-none"
              aria-label="Back to Articles"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              <span>Articles</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 font-medium">Reader Pane</div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-lg shadow-black/40">
            <BookOpen className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No Article Selected</h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
            Select an article from your timeline to read, or tap below to browse stories.
          </p>
          {isMobile && onBackToTimeline && (
            <button
              onClick={onBackToTimeline}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Back to Articles</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <main
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full flex-1 bg-slate-950 flex flex-col h-full overflow-hidden select-text relative"
    >
      {/* Top Reading Toolbar with iOS Safe Area padding */}
      <div className="ios-header-safe pb-2.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between shrink-0 z-10 gap-2">
        <div className="flex items-center gap-2 truncate min-w-0">
          {isMobile && onBackToTimeline && (
            <button
              onClick={onBackToTimeline}
              className="inline-flex items-center gap-1 py-1.5 px-2.5 -ml-1.5 text-amber-400 hover:text-amber-300 active:bg-slate-800/90 rounded-xl transition font-semibold text-xs touch-manipulation select-none shrink-0"
              aria-label="Back to Articles"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              <span>Articles</span>
            </button>
          )}

          <div className="truncate text-xs min-w-0">
            <span className="font-semibold text-slate-200 truncate block sm:inline">{article.feedTitle}</span>
            <span className="text-slate-500 mx-1.5 hidden sm:inline">&bull;</span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">{domain}</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* AI 1-Sentence Summary Button with Tooltip */}
          <div className="relative group">
            <button
              onClick={handleSummarizeArticle}
              disabled={isSummarizing}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                isSummarizing
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40 cursor-wait'
                  : showSummary && currentSummary
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-sm shadow-purple-500/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800 hover:border-purple-500/40'
              }`}
              title="Generate 1-sentence summary with Gemini"
              aria-label="Generate 1-sentence summary with Gemini"
            >
              {isSummarizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              ) : (
                <Zap className={`w-3.5 h-3.5 ${showSummary && currentSummary ? 'text-amber-300 fill-amber-300' : 'text-purple-400 fill-purple-400/20'}`} />
              )}
              <span className="hidden sm:inline">
                {isSummarizing ? 'Summarizing...' : showSummary && currentSummary ? 'Summary' : 'AI Summary'}
              </span>
            </button>

            {/* Hover Tooltip */}
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-50 pointer-events-none whitespace-nowrap bg-slate-900 border border-purple-500/30 text-purple-200 text-[11px] px-2.5 py-1 rounded-md shadow-lg shadow-black/60">
              {currentSummary ? (showSummary ? 'Hide 1-sentence summary' : 'Show 1-sentence summary') : 'Gemini 1-Sentence Summary'}
            </div>
          </div>

          {/* Reader Mode Button */}
          <button
            onClick={handleToggleReaderMode}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              isReaderMode
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
            title="Toggle Reader Mode / Full Extractor"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reader View</span>
          </button>

          {/* Font Size Controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={handleDecreaseFontSize}
              className="px-2 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition border-r border-slate-800 font-medium"
              title="Decrease font size (A-)"
              aria-label="Decrease font size"
            >
              A-
            </button>
            <span className="px-1.5 text-[10px] text-slate-400 font-mono uppercase hidden sm:inline">
              {fontSize}
            </span>
            <button
              onClick={handleIncreaseFontSize}
              className="px-2 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition border-l border-slate-800 font-medium"
              title="Increase font size (A+)"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>

          {/* Read Aloud Button */}
          <button
            onClick={isSpeaking ? (isPaused ? handleResumeSpeech : handlePauseSpeech) : handleStartSpeech}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              isSpeaking
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm animate-pulse'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
            title={isSpeaking ? (isPaused ? 'Resume reading' : 'Pause reading') : 'Read Aloud'}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isSpeaking ? (isPaused ? 'Resume' : 'Listening...') : 'Read Aloud'}
            </span>
          </button>

          {/* Star Button */}
          <button
            onClick={() => {
              onToggleStar();
            }}
            className={`p-2 rounded-lg transition ${
              isStarred
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isStarred ? 'Unstar article' : 'Star article'}
          >
            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Read / Unread Toggle */}
          <button
            onClick={() => {
              onToggleRead();
            }}
            className={`p-2 rounded-lg transition ${
              isRead ? 'text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isRead ? 'Mark as Unread' : 'Mark as Read'}
          >
            <CheckCircle className={`w-4 h-4 ${isRead ? 'fill-emerald-500/20' : ''}`} />
          </button>

          {/* Share */}
          <button
            onClick={() => {
              handleShare();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Share article link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* External Link */}
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Open original webpage in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Share Toast */}
      {showShareToast && (
        <div className="absolute top-16 right-6 z-30 bg-slate-800 text-white border border-slate-700 text-xs px-3 py-1.5 rounded-lg shadow-lg">
          Link copied to clipboard!
        </div>
      )}

      {/* Article Content Container */}
      <div
        key={article.id}
        className="flex-1 overflow-y-auto pt-6 pb-[calc(92px+max(24px,env(safe-area-inset-bottom,24px)))] overscroll-y-contain animate-content-fade"
      >
        <article className={`${marginClass} ${lineHeightClass} font-sans`}>
          {/* Reader Mode Indicator */}
          {isReaderMode && (
            <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Reader Mode Active: Clean ad-free article extraction.</span>
              </div>
              {scrapedData && (
                <span className="text-[11px] font-mono text-amber-400">
                  {scrapedData.readingTimeMin} min read
                </span>
              )}
            </div>
          )}

          {/* 1-Sentence AI Summary Header Callout */}
          {showSummary && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-purple-950/70 via-indigo-950/50 to-slate-900 border border-purple-500/30 text-purple-100 shadow-xl relative animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                    1-Sentence Summary
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Gemini
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {currentSummary && (
                    <button
                      onClick={handleCopySummary}
                      className="p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-800/40 active:scale-95 transition text-xs flex items-center gap-1"
                      title="Copy summary"
                    >
                      {hasCopiedSummary ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px] text-emerald-400 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px] hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowSummary(false)}
                    className="p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-800/40 transition"
                    title="Dismiss summary banner"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isSummarizing ? (
                <div className="py-2.5 flex items-center gap-2.5 text-xs text-purple-300/80">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                  <span>Generating one-sentence summary with Gemini...</span>
                </div>
              ) : summaryError ? (
                <div className="py-2 px-3 rounded-xl bg-rose-950/40 border border-rose-500/20 text-xs text-rose-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="leading-tight">{summaryError}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    {isAuthError ? (
                      <button
                        onClick={() => {
                          if (onOpenAuth) {
                            onOpenAuth();
                          } else {
                            setShowInlineAuth(true);
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Unlock with Passcode</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handleSummarizeArticle();
                        }}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-medium transition"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ) : currentSummary ? (
                <p className="text-sm sm:text-base text-purple-50 leading-relaxed font-medium">
                  &ldquo;{currentSummary}&rdquo;
                </p>
              ) : null}
            </div>
          )}

          {/* Article Header */}
          <header className="mb-8 border-b border-slate-800/80 pb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mb-4">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {article.author && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300 font-medium">{article.author}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {new Date(article.pubDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>

              {/* Estimated Reading Time */}
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-slate-600">&bull;</span>
                <span className="font-medium text-slate-300">{readingTimeMin} min read</span>
              </div>

              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline flex items-center gap-1"
              >
                <span className="text-slate-600">&bull;</span>
                <span>{domain}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </header>

          {/* Lead / Hero Image: Only displayed if the article HTML body does not already contain it */}
          {shouldShowHeroBanner && (
            <div className="mb-8 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl">
              <img
                src={heroBannerUrl}
                alt=""
                className="w-full max-h-96 object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Article HTML Content */}
          {isReaderMode && isScraping ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-xs">Scraping and cleaning article content...</p>
            </div>
          ) : isReaderMode && scrapeError ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-6">
              {scrapeError} Displaying RSS summary below.
              <div
                className={`mt-4 prose prose-invert prose-slate max-w-none text-slate-300 article-reader-content ${fontSizeClass} ${lineHeightClass}`}
                dangerouslySetInnerHTML={{
                  __html: displayHtml
                }}
              />
            </div>
          ) : (
            <div
              className={`prose prose-invert prose-slate max-w-none text-slate-200 article-reader-content ${fontSizeClass} ${lineHeightClass} 
                [&_a]:text-amber-400 [&_a]:underline [&_p]:mb-4
                [&_img]:rounded-xl [&_img]:my-6 [&_img]:max-w-full [&_img]:border [&_img]:border-slate-800
                [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-white
                [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-white
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:mb-1
                [&_blockquote]:border-l-4 [&_blockquote]:border-amber-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-400
                [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-slate-800 [&_pre]:overflow-x-auto`}
              dangerouslySetInnerHTML={{
                __html: displayHtml
              }}
            />
          )}

          {/* Footer Action */}
          <div className="mt-12 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Read full story at origin</span>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl flex items-center gap-1.5 transition"
            >
              <span>Visit {domain}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </article>
      </div>

      {/* Floating Read Aloud Audio Player Bar */}
      {isSpeaking && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-96 z-40 bg-slate-900/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Volume2 className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{article.title}</div>
            <div className="text-[11px] text-emerald-400/90 flex items-center gap-2 mt-0.5">
              <span>{isPaused ? 'Paused' : 'Listening...'}</span>
              <span>&bull;</span>
              <button
                onClick={() => handleRateChange(speechRate === 1.0 ? 1.25 : speechRate === 1.25 ? 1.5 : speechRate === 1.5 ? 0.75 : 1.0)}
                className="hover:underline font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded"
                title="Change Speed"
              >
                {speechRate}x
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isPaused ? (
              <button
                onClick={handleResumeSpeech}
                className="p-2 bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition"
                title="Resume"
              >
                <Play className="w-4 h-4 fill-slate-950" />
              </button>
            ) : (
              <button
                onClick={handlePauseSpeech}
                className="p-2 bg-slate-800 text-slate-200 rounded-xl hover:bg-slate-700 transition"
                title="Pause"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleStopSpeech}
              className="p-2 bg-slate-800 text-rose-400 rounded-xl hover:bg-slate-700 transition"
              title="Stop"
            >
              <Square className="w-4 h-4 fill-rose-400" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Quick-Action Bar in natural thumb reach zone */}
      {isMobile && (
        <MobileReaderBar
          hasPrevArticle={hasPrevArticle}
          hasNextArticle={hasNextArticle}
          onPrevArticle={onPrevArticle}
          onNextArticle={onNextArticle}
          isStarred={isStarred}
          isRead={isRead}
          onToggleStar={onToggleStar}
          onToggleRead={onToggleRead}
          onShare={handleShare}
        />
      )}

      {showInlineAuth && (
        <AuthModal
          isDismissible
          onClose={() => setShowInlineAuth(false)}
          onAuthenticated={() => {
            setShowInlineAuth(false);
            setIsAuthError(false);
            setSummaryError(null);
            handleSummarizeArticle();
          }}
        />
      )}
    </main>
  );
};
