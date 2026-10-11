/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { ArticleView } from './components/ArticleView';
import { AddFeedModal } from './components/AddFeedModal';
import { SettingsModal } from './components/SettingsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { UndoToast } from './components/UndoToast';
import { Feed, Article, SmartFilter, AIBriefing, AIBriefingStory, DEFAULT_FOLDER } from './types';
import {
  getLocalFeeds,
  saveLocalFeeds,
  getLocalArticleState,
  saveLocalArticleState,
  getLocalCachedArticles,
  saveLocalCachedArticles,
  hasLocalUserData,
  getLocalDeletedFeedUrls,
  saveLocalDeletedFeedUrls,
  getLocalDateKey,
  getLocalDailyBriefing,
  saveLocalDailyBriefing,
  clearLocalDailyBriefing,
  getLocalBriefingAttemptDate,
  markLocalBriefingAttempt
} from './utils/storage';
import { getJsonHeaders } from './utils/api';
import { formatTag } from './utils/tagUtils';

const DEFAULT_FEEDS: Feed[] = [
  {
    id: 'feed-inessential',
    title: 'inessential (Brent Simmons)',
    url: 'https://inessential.com/xml/rss.xml',
    homeUrl: 'https://inessential.com',
    folder: 'Indie Mac & Swift',
    favicon: 'https://inessential.com/favicon.ico',
    lastFetched: null
  },
  {
    id: 'feed-daringfireball',
    title: 'Daring Fireball (John Gruber)',
    url: 'https://daringfireball.net/feeds/main',
    homeUrl: 'https://daringfireball.net',
    folder: 'Indie Mac & Swift',
    favicon: 'https://daringfireball.net/favicon.ico',
    lastFetched: null
  },
  {
    id: 'feed-simonwillison',
    title: "Simon Willison's Weblog",
    url: 'https://simonwillison.net/atom/everything/',
    homeUrl: 'https://simonwillison.net',
    folder: 'Tech & Architecture',
    favicon: 'https://simonwillison.net/favicon.ico',
    lastFetched: null
  },
  {
    id: 'feed-hn',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com/rss',
    homeUrl: 'https://news.ycombinator.com',
    folder: 'Tech & Architecture',
    favicon: 'https://news.ycombinator.com/favicon.ico',
    lastFetched: null
  }
];

interface PendingDelete {
  article: Article;
  wasArchived: boolean;
}

// Undoable destructive actions share a single transient toast slot.
type PendingUndo =
  | { id: number; kind: 'delete'; entries: PendingDelete[] }
  | { id: number; kind: 'markRead'; ids: string[] };

// How long the user has to undo a destructive action before the toast expires.
const UNDO_WINDOW_MS = 6000;

export default function App() {
  // Data State with Local-First Persistence: Initialized directly from device storage
  const [feeds, setFeeds] = useState<Feed[]>(() => {
    const local = getLocalFeeds();
    return local !== null ? local : DEFAULT_FEEDS;
  });
  const [articles, setArticles] = useState<Article[]>(() => {
    return getLocalCachedArticles();
  });
  const initialArticleState = useMemo(() => getLocalArticleState(), []);
  const [readArticleIds, setReadArticleIds] = useState<Set<string>>(() => initialArticleState.readArticleIds);
  const [starredArticleIds, setStarredArticleIds] = useState<Set<string>>(() => initialArticleState.starredArticleIds);
  const [archivedArticleIds, setArchivedArticleIds] = useState<Set<string>>(() => initialArticleState.archivedArticleIds);
  const [deletedArticleIds, setDeletedArticleIds] = useState<Set<string>>(() => initialArticleState.deletedArticleIds);
  const [deletedFeedUrls, setDeletedFeedUrls] = useState<Set<string>>(() => getLocalDeletedFeedUrls());
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Last completed refresh, surfaced as an honest relative time in the sidebar header.
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Single-slot undo affordance for destructive actions
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoSeqRef = useRef(0);

  // AI Briefing State. The digest is a per-day artefact, so it is hydrated from
  // device storage and only regenerated when it is stale, dismissed, or asked for.
  const [aiBriefing, setAiBriefing] = useState<AIBriefing | null>(() => getLocalDailyBriefing());
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [isBriefingExpanded, setIsBriefingExpanded] = useState(true);

  // Navigation & Selection State
  const [activeFilter, setActiveFilter] = useState<SmartFilter>({
    type: 'today',
    title: 'Today'
  });
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Mobile / Tablet Drill-down Navigation: 'sidebar' | 'timeline' | 'reader'
  const [mobilePane, setMobilePane] = useState<'sidebar' | 'timeline' | 'reader'>('sidebar');
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });

  // Modals
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Responsive listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // (Re)start the undo countdown whenever a new undoable action is queued, and
  // clear it on unmount.
  useEffect(() => {
    if (!pendingUndo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setPendingUndo(null);
      undoTimerRef.current = null;
    }, UNDO_WINDOW_MS);
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [pendingUndo]);

  // State refs to prevent stale closures and infinite effect loops
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const readRef = useRef(readArticleIds);
  readRef.current = readArticleIds;
  const starredRef = useRef(starredArticleIds);
  starredRef.current = starredArticleIds;
  const archivedRef = useRef(archivedArticleIds);
  archivedRef.current = archivedArticleIds;
  const deletedArticleRef = useRef(deletedArticleIds);
  deletedArticleRef.current = deletedArticleIds;
  const deletedFeedRef = useRef(deletedFeedUrls);
  deletedFeedRef.current = deletedFeedUrls;

  // Sync read, starred, archived & deleted state with backend & device
  const syncStateWithServer = useCallback(
    (
      newFeeds?: Feed[],
      newRead?: Set<string>,
      newStarred?: Set<string>,
      newArchived?: Set<string>,
      newDeleted?: Set<string>,
      newDeletedFeeds?: Set<string>
    ) => {
      const feedsToSave = newFeeds !== undefined ? newFeeds : feedsRef.current;
      const readToSave = newRead !== undefined ? newRead : readRef.current;
      const starredToSave = newStarred !== undefined ? newStarred : starredRef.current;
      const archivedToSave = newArchived !== undefined ? newArchived : archivedRef.current;
      const deletedToSave = newDeleted !== undefined ? newDeleted : deletedArticleRef.current;
      const deletedFeedsToSave = newDeletedFeeds !== undefined ? newDeletedFeeds : deletedFeedRef.current;

      // 1. Immediately persist on device
      saveLocalFeeds(feedsToSave);
      saveLocalArticleState(readToSave, starredToSave, archivedToSave, deletedToSave);
      saveLocalDeletedFeedUrls(deletedFeedsToSave);

      // 2. Synchronize with server in the background
      fetch('/api/storage', {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          feeds: feedsToSave,
          readArticleIds: Array.from(readToSave),
          starredArticleIds: Array.from(starredToSave),
          archivedArticleIds: Array.from(archivedToSave),
          deletedArticleIds: Array.from(deletedToSave),
          deletedFeedUrls: Array.from(deletedFeedsToSave)
        })
      }).catch((e) => console.warn('Server sync note (device storage is primary):', e));
    },
    []
  );

  // Fetch & Synchronize feeds with Backend / Storage Mirror
  const loadStoredData = useCallback(async () => {
    const localFeeds = getLocalFeeds();
    const isCustomized = hasLocalUserData() && localFeeds !== null;
    const localDeleted = getLocalDeletedFeedUrls();

    try {
      const res = await fetch('/api/storage', {
        headers: getJsonHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const serverFeeds: Feed[] = Array.isArray(data.feeds) ? data.feeds : [];
        if (Array.isArray(data.deletedFeedUrls)) {
          data.deletedFeedUrls.forEach((u: string) => localDeleted.add(u));
          saveLocalDeletedFeedUrls(localDeleted);
          setDeletedFeedUrls(new Set(localDeleted));
        }

        if (isCustomized && localFeeds) {
          // Priority 1: User's device has existing customized data
          // Merge newly discovered server feeds without overwriting user library or resurrecting deleted feeds
          const localMap = new Map(localFeeds.map((f) => [f.id, f]));
          const localUrls = new Set(localFeeds.map((f) => f.url));
          const mergedFeeds = [...localFeeds];
          let newFound = false;

          serverFeeds.forEach((sf) => {
            if (localDeleted.has(sf.url) || localDeleted.has(sf.id)) {
              return; // Do not resurrect deleted feed
            }
            if (!localMap.has(sf.id) && !localUrls.has(sf.url)) {
              mergedFeeds.push(sf);
              newFound = true;
            }
          });

          if (newFound) {
            setFeeds(mergedFeeds);
            saveLocalFeeds(mergedFeeds);
          }

          // Ensure the server mirror has the user's latest feeds
          syncStateWithServer(mergedFeeds, undefined, undefined, undefined, undefined, localDeleted);
          return mergedFeeds;
        } else {
          // Priority 2: Fresh installation or first load on new browser
          const activeFeeds = (serverFeeds.length > 0 ? serverFeeds : DEFAULT_FEEDS)
            .filter((sf) => !localDeleted.has(sf.url) && !localDeleted.has(sf.id));
          setFeeds(activeFeeds);
          saveLocalFeeds(activeFeeds);

          if (data.readArticleIds) {
            const read = new Set<string>(data.readArticleIds);
            setReadArticleIds(read);
            saveLocalArticleState(read);
          }
          if (data.starredArticleIds) {
            const starred = new Set<string>(data.starredArticleIds);
            setStarredArticleIds(starred);
            saveLocalArticleState(undefined, starred);
          }
          if (data.archivedArticleIds) {
            const archived = new Set<string>(data.archivedArticleIds);
            setArchivedArticleIds(archived);
            saveLocalArticleState(undefined, undefined, archived);
          }
          if (data.deletedArticleIds) {
            const deleted = new Set<string>(data.deletedArticleIds);
            setDeletedArticleIds(deleted);
            saveLocalArticleState(undefined, undefined, undefined, deleted);
          }

          return activeFeeds;
        }
      }
    } catch (err) {
      console.warn('Network unavailable, continuing with local persistent storage:', err);
    }

    const currentFeeds = (localFeeds !== null ? localFeeds : DEFAULT_FEEDS)
      .filter((sf) => !localDeleted.has(sf.url) && !localDeleted.has(sf.id));
    saveLocalFeeds(currentFeeds);
    return currentFeeds;
  }, [syncStateWithServer]);

  // Poll / fetch articles from all feeds
  const refreshAllFeeds = useCallback(async (feedsToFetch?: Feed[]) => {
    const targets = feedsToFetch || feeds;
    if (targets.length === 0) return;

    setIsRefreshing(true);
    const newArticlesList: Article[] = [];
    let updatedFeedsNeeded = false;
    const feedUpdates: Record<string, string> = {};

    await Promise.allSettled(
      targets.map(async (feed) => {
        try {
          const res = await fetch('/api/feeds/fetch', {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ url: feed.url })
          });
          if (res.ok) {
            const data = await res.json();
            const resolvedFeedUrl = data.feedUrl || feed.url;

            if (data.feedUrl && data.feedUrl !== feed.url) {
              updatedFeedsNeeded = true;
              feedUpdates[feed.id] = data.feedUrl;
            }

            if (data.items) {
              data.items.forEach((item: any) => {
                newArticlesList.push({
                  ...item,
                  feedTitle: feed.title || data.title,
                  feedUrl: resolvedFeedUrl
                });
              });
            }
          }
        } catch (err) {
          console.warn(`Feed update note for ${feed.url}:`, err);
        }
      })
    );

    if (updatedFeedsNeeded) {
      setFeeds((prev) => {
        const next = prev.map((f) =>
          feedUpdates[f.id] ? { ...f, url: feedUpdates[f.id] } : f
        );
        syncStateWithServer(next);
        return next;
      });
    }

    // Merge and sort articles by date descending
    setArticles((prev) => {
      const map = new Map<string, Article>();
      // Keep existing
      prev.forEach((a) => map.set(a.id, a));
      // Add or update new
      newArticlesList.forEach((a) => map.set(a.id, a));

      const sorted = Array.from(map.values()).sort((a, b) => {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      });

      // Save article cache in device storage for instant offline loads
      saveLocalCachedArticles(sorted);

      return sorted;
    });

    setIsRefreshing(false);
    setLastRefreshedAt(new Date().toISOString());
  }, [feeds, syncStateWithServer]);

  // Initial load on mount
  useEffect(() => {
    loadStoredData().then((loadedFeeds) => {
      if (loadedFeeds && loadedFeeds.length > 0) {
        refreshAllFeeds(loadedFeeds);
      }
    });
  }, []);

  // Add Feed Handler
  const handleFeedAdded = (newFeed: Feed) => {
    const updatedFeeds = [...feeds, newFeed];
    setFeeds(updatedFeeds);
    saveLocalFeeds(updatedFeeds);
    syncStateWithServer(updatedFeeds);
    refreshAllFeeds([newFeed]);
    setActiveFilter({ type: 'feed', id: newFeed.id, title: newFeed.title });
    if (isMobile) setMobilePane('timeline');
  };

  // Bulk Feeds Added Handler (e.g. from Google Search Recommended Feeds)
  const handleBulkFeedsAdded = (newFeeds: Feed[]) => {
    if (!newFeeds || newFeeds.length === 0) return;
    const currentUrls = new Set(feeds.map((f) => f.url));
    const toAdd = newFeeds.filter((f) => !currentUrls.has(f.url));
    if (toAdd.length === 0) return;

    const updatedFeeds = [...feeds, ...toAdd];
    setFeeds(updatedFeeds);
    saveLocalFeeds(updatedFeeds);
    syncStateWithServer(updatedFeeds);
    refreshAllFeeds(toAdd);
    setActiveFilter({ type: 'all', title: 'All Articles' });
    if (isMobile) setMobilePane('timeline');
  };

  // Delete Feed Handler
  const handleDeleteFeed = (feedId: string) => {
    const feedToDelete = feeds.find((f) => f.id === feedId);
    const updatedFeeds = feeds.filter((f) => f.id !== feedId);
    setFeeds(updatedFeeds);
    saveLocalFeeds(updatedFeeds);

    const nextDeleted = new Set(deletedFeedUrls);
    nextDeleted.add(feedId);
    if (feedToDelete) {
      nextDeleted.add(feedToDelete.url);
    }
    setDeletedFeedUrls(nextDeleted);
    saveLocalDeletedFeedUrls(nextDeleted);

    syncStateWithServer(updatedFeeds, undefined, undefined, undefined, undefined, nextDeleted);
    if (activeFilter.type === 'feed' && activeFilter.id === feedId) {
      setActiveFilter({ type: 'all', title: 'All Articles' });
    }
  };

  // Update a feed's editable metadata (used by the "Move to Folder" affordance).
  // Letting the reader re-file a feed is the durable fix when auto-categorization
  // puts a publication in the wrong folder (e.g. a podcast-style Substack).
  const handleUpdateFeed = useCallback((feedId: string, updates: Partial<Feed>) => {
    setFeeds((prev) => {
      const next = prev.map((f) => (f.id === feedId ? { ...f, ...updates } : f));
      saveLocalFeeds(next);
      syncStateWithServer(next);
      return next;
    });
  }, [syncStateWithServer]);

  // Rename a folder across every feed filed in it. Folders are a labelling of
  // feeds rather than records of their own, so a rename re-files the whole group;
  // renaming onto an existing name merges the two folders. Both stores are
  // updated, so the new name survives a reload on any device.
  const handleRenameFolder = useCallback(
    (oldName: string, newName: string) => {
      const target = newName.trim();
      if (!target || target === oldName) return;

      setFeeds((prev) => {
        const next = prev.map((f) =>
          (f.folder || DEFAULT_FOLDER) === oldName ? { ...f, folder: target } : f
        );
        saveLocalFeeds(next);
        syncStateWithServer(next);
        return next;
      });

      // Keep the reader on the renamed group instead of a now-empty filter.
      setActiveFilter((prev) =>
        prev.type === 'folder' && prev.id === oldName
          ? { ...prev, id: target, title: target }
          : prev
      );
    },
    [syncStateWithServer]
  );

  // Delete Article Handler (permanent deletion across devices)
  const handleDeleteArticle = useCallback((articleId: string) => {
    setDeletedArticleIds((prev) => {
      const next = new Set(prev);
      next.add(articleId);
      saveLocalArticleState(undefined, undefined, undefined, next);
      syncStateWithServer(undefined, undefined, undefined, undefined, next);
      return next;
    });
    setArticles((prev) => {
      const filtered = prev.filter((a) => a.id !== articleId);
      saveLocalCachedArticles(filtered);
      return filtered;
    });

    // Queue a transient undo affordance. The deletion is applied immediately;
    // the user gets a short window to restore the article.
    const removed = articlesRef.current.find((a) => a.id === articleId);
    if (removed) {
      const entry: PendingDelete = {
        article: removed,
        wasArchived: archivedRef.current.has(articleId)
      };
      setPendingUndo((prev) => {
        const prevEntries = prev && prev.kind === 'delete' ? prev.entries : [];
        return {
          id: ++undoSeqRef.current,
          kind: 'delete',
          entries: [...prevEntries.filter((e) => e.article.id !== articleId), entry]
        };
      });
    }

    if (selectedArticleId === articleId) {
      setSelectedArticleId(null);
      if (isMobile) {
        setMobilePane('timeline');
      }
    }
    fetch('/api/articles/action', {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ action: 'delete', articleId })
    }).catch(console.error);
  }, [selectedArticleId, syncStateWithServer, isMobile]);

  // Undo a queued article deletion (restores articles locally and on the server)
  const restoreDeletedArticles = useCallback((entries: PendingDelete[]) => {
    if (entries.length === 0) return;

    const restoredIds = new Set(entries.map((entry) => entry.article.id));
    const reArchiveIds = entries
      .filter((entry) => entry.wasArchived)
      .map((entry) => entry.article.id);

    setDeletedArticleIds((prev) => {
      const next = new Set(prev);
      restoredIds.forEach((id) => next.delete(id));
      saveLocalArticleState(undefined, undefined, undefined, next);
      syncStateWithServer(undefined, undefined, undefined, undefined, next);
      return next;
    });

    if (reArchiveIds.length > 0) {
      setArchivedArticleIds((prev) => {
        const next = new Set(prev);
        reArchiveIds.forEach((id) => next.add(id));
        saveLocalArticleState(undefined, undefined, next);
        syncStateWithServer(undefined, undefined, next);
        return next;
      });
    }

    setArticles((prev) => {
      const existing = new Set(prev.map((a) => a.id));
      const toAdd = entries
        .map((entry) => entry.article)
        .filter((a) => !existing.has(a.id));
      const merged = [...prev, ...toAdd].sort(
        (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
      );
      saveLocalCachedArticles(merged);
      return merged;
    });

    fetch('/api/articles/action', {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ action: 'restore', articleIds: Array.from(restoredIds) })
    }).catch(console.error);
  }, [syncStateWithServer]);

  // Undo a "mark all as read" (reverts only the articles that were newly read)
  const unmarkArticlesRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setReadArticleIds((prev) => {
      const next = new Set(prev);
      idSet.forEach((id) => next.delete(id));
      saveLocalArticleState(next);
      syncStateWithServer(undefined, next);
      return next;
    });
  }, [syncStateWithServer]);

  // Reverse whichever destructive action is currently pending
  const handleUndo = useCallback(() => {
    const current = pendingUndo;
    setPendingUndo(null);
    if (!current) return;
    if (current.kind === 'delete') {
      restoreDeletedArticles(current.entries);
    } else {
      unmarkArticlesRead(current.ids);
    }
  }, [pendingUndo, restoreDeletedArticles, unmarkArticlesRead]);

  const handleDismissUndo = useCallback(() => setPendingUndo(null), []);

  // Update Article Handler (editing entry including podcast title)
  const handleUpdateArticle = useCallback((updatedArticle: Article) => {
    setArticles((prev) => {
      const next = prev.map((a) => (a.id === updatedArticle.id ? updatedArticle : a));
      saveLocalCachedArticles(next);
      return next;
    });
    fetch('/api/articles/update', {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify(updatedArticle)
    }).catch(() => {
      // ignore offline errors
    });
  }, []);

  // Archive Article Handler
  const handleArchiveArticle = useCallback((articleId: string) => {
    setArchivedArticleIds((prev) => {
      const next = new Set(prev);
      next.add(articleId);
      saveLocalArticleState(undefined, undefined, next);
      syncStateWithServer(undefined, undefined, undefined, next);
      return next;
    });
    if (selectedArticleId === articleId && activeFilter.type !== 'archive') {
      setSelectedArticleId(null);
      if (isMobile) {
        setMobilePane('timeline');
      }
    }
    fetch('/api/articles/action', {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ action: 'archive', articleId })
    }).catch(console.error);
  }, [selectedArticleId, syncStateWithServer, activeFilter.type, isMobile]);

  // Unarchive Article Handler
  const handleUnarchiveArticle = useCallback((articleId: string) => {
    setArchivedArticleIds((prev) => {
      const next = new Set(prev);
      next.delete(articleId);
      saveLocalArticleState(undefined, undefined, next);
      syncStateWithServer(undefined, undefined, undefined, next);
      return next;
    });
    fetch('/api/articles/action', {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ action: 'unarchive', articleId })
    }).catch(console.error);
  }, [syncStateWithServer]);

  // Toggle Read Handler
  const handleToggleRead = useCallback((articleId: string) => {
    setReadArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      saveLocalArticleState(next);
      syncStateWithServer(undefined, next);
      return next;
    });
  }, [syncStateWithServer]);

  // Filtered Articles calculation
  const displayedArticles = useMemo(() => {
    const todayCutoff = new Date();
    todayCutoff.setHours(0, 0, 0, 0);

    return articles.filter((article) => {
      // Never show deleted articles
      if (deletedArticleIds.has(article.id)) return false;

      // Archive view specifically shows archived articles
      if (activeFilter.type === 'archive') {
        return archivedArticleIds.has(article.id);
      }

      // Hide archived articles from active feeds and smart lists
      if (archivedArticleIds.has(article.id)) return false;

      switch (activeFilter.type) {
        case 'today':
          return new Date(article.pubDate) >= todayCutoff;
        case 'unread':
          return !readArticleIds.has(article.id);
        case 'starred':
          return starredArticleIds.has(article.id);
        case 'feed': {
          const targetFeed = feeds.find((f) => f.id === activeFilter.id);
          return targetFeed ? article.feedUrl === targetFeed.url : true;
        }
        case 'folder': {
          const folderFeeds = feeds.filter((f) => (f.folder || DEFAULT_FOLDER) === activeFilter.id);
          const urls = new Set(folderFeeds.map((f) => f.url));
          return urls.has(article.feedUrl);
        }
        case 'tag': {
          const tagTarget = formatTag(activeFilter.id || '').toLowerCase();
          const taggedFeeds = feeds.filter(
            (f) =>
              Array.isArray(f.tags) &&
              f.tags.some((t) => formatTag(t).toLowerCase() === tagTarget)
          );
          const urls = new Set(taggedFeeds.map((f) => f.url));
          return urls.has(article.feedUrl);
        }
        case 'all':
        default:
          return true;
      }
    });
  }, [articles, activeFilter, feeds, readArticleIds, starredArticleIds, archivedArticleIds, deletedArticleIds]);

  // Mark All As Read (reversible)
  const handleMarkAllAsRead = useCallback(() => {
    const newlyRead = displayedArticles
      .filter((a) => !readArticleIds.has(a.id))
      .map((a) => a.id);
    if (newlyRead.length === 0) return;

    setReadArticleIds((prev) => {
      const next = new Set(prev);
      newlyRead.forEach((id) => next.add(id));
      saveLocalArticleState(next);
      syncStateWithServer(undefined, next);
      return next;
    });

    setPendingUndo({ id: ++undoSeqRef.current, kind: 'markRead', ids: newlyRead });
  }, [displayedArticles, readArticleIds, syncStateWithServer]);

  // Toggle Star Handler
  const handleToggleStar = useCallback((articleId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStarredArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      saveLocalArticleState(undefined, next);
      syncStateWithServer(undefined, undefined, next);
      return next;
    });
    fetch('/api/articles/action', {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ action: 'toggle-favorite', articleId })
    }).catch(console.error);
  }, [syncStateWithServer]);

  // ======================== AI DAILY BRIEFING (MORNING DIGEST) ========================
  // The digest covers the reader's unread stories from the last 24 hours, newest
  // first. When the day is quiet we widen to every unread story, so a built-in
  // fallback day still produces a useful digest instead of an empty one.
  const collectBriefingArticles = useCallback(() => {
    const unread = articles.filter(
      (a) => !deletedArticleIds.has(a.id) && !archivedArticleIds.has(a.id) && !readArticleIds.has(a.id)
    );
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const fresh = unread.filter((a) => {
      const t = new Date(a.pubDate).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
    const pool = (fresh.length > 0 ? fresh : unread).slice();
    pool.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    return pool;
  }, [articles, deletedArticleIds, archivedArticleIds, readArticleIds]);

  const handleGenerateBriefing = useCallback(async () => {
    const pool = collectBriefingArticles();
    if (pool.length === 0) return;

    setIsGeneratingBriefing(true);
    setIsBriefingExpanded(true);

    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getJsonHeaders()
        },
        body: JSON.stringify({
          articles: pool.slice(0, 40).map((a) => ({
            id: a.id,
            title: a.title,
            snippet: a.snippet,
            content: (a.content || '').slice(0, 1200),
            link: a.link,
            feedTitle: a.feedTitle,
            pubDate: a.pubDate
          }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.paragraph === 'string') {
          const briefing: AIBriefing = {
            paragraph: data.paragraph,
            themes: Array.isArray(data.themes) ? data.themes : [],
            topStories: Array.isArray(data.topStories) ? data.topStories : [],
            articlesCount: data.articlesCount || pool.length,
            generatedAt: data.generatedAt || new Date().toISOString(),
            date: getLocalDateKey(),
            poweredBy: data.poweredBy,
            source: data.source === 'gemini' ? 'gemini' : 'fallback'
          };
          setAiBriefing(briefing);
          saveLocalDailyBriefing(briefing);
          setIsBriefingExpanded(true);
        }
      }
    } catch (err) {
      console.error('Failed to generate AI briefing:', err);
    } finally {
      setIsGeneratingBriefing(false);
    }
  }, [collectBriefingArticles]);

  const handleToggleBriefingCollapse = useCallback(() => {
    setIsBriefingExpanded((prev) => !prev);
  }, []);

  const handleDismissBriefing = useCallback(() => {
    // Dismissing hides the digest for the rest of the day: the stored copy is
    // dropped and the day's attempt stamp (already written) keeps it from being
    // regenerated on the next load. Tomorrow it comes back on its own.
    setAiBriefing(null);
    clearLocalDailyBriefing();
    markLocalBriefingAttempt(getLocalDateKey());
  }, []);

  // Morning Digest: generate once per local day, and only after the first refresh
  // has completed so the digest covers today's stories rather than yesterday's
  // cache. The attempt is stamped *before* the request, so a failure or a rate
  // limit never becomes a retry loop on every reload; the reader can always
  // regenerate by hand with the refresh control on the card.
  useEffect(() => {
    if (aiBriefing || isGeneratingBriefing || isRefreshing) return;
    if (articles.length === 0 || lastRefreshedAt === null) return;
    const today = getLocalDateKey();
    if (getLocalBriefingAttemptDate() === today) return;
    const unreadNow = articles.filter(
      (a) => !deletedArticleIds.has(a.id) && !archivedArticleIds.has(a.id) && !readArticleIds.has(a.id)
    ).length;
    if (unreadNow === 0) return;
    markLocalBriefingAttempt(today);
    void handleGenerateBriefing();
  }, [
    aiBriefing,
    isGeneratingBriefing,
    isRefreshing,
    articles,
    lastRefreshedAt,
    deletedArticleIds,
    archivedArticleIds,
    readArticleIds,
    handleGenerateBriefing
  ]);

  // Selected article reference
  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    return articles.find((a) => a.id === selectedArticleId) || null;
  }, [articles, selectedArticleId]);

  // Index of currently selected article in displayed list
  const selectedArticleIndex = useMemo(() => {
    if (!selectedArticleId) return -1;
    return displayedArticles.findIndex((a) => a.id === selectedArticleId);
  }, [displayedArticles, selectedArticleId]);

  const hasPrevArticle = selectedArticleIndex > 0;
  const hasNextArticle = selectedArticleIndex !== -1 && selectedArticleIndex < displayedArticles.length - 1;

  const handlePrevArticle = useCallback(() => {
    if (selectedArticleIndex > 0) {
      handleSelectArticle(displayedArticles[selectedArticleIndex - 1]);
    }
  }, [selectedArticleIndex, displayedArticles]);

  const handleNextArticle = useCallback(() => {
    if (selectedArticleIndex !== -1 && selectedArticleIndex < displayedArticles.length - 1) {
      handleSelectArticle(displayedArticles[selectedArticleIndex + 1]);
    }
  }, [selectedArticleIndex, displayedArticles]);

  // Select article & auto-mark as read
  const handleSelectArticle = (article: Article) => {
    setSelectedArticleId(article.id);
    if (!readArticleIds.has(article.id)) {
      setReadArticleIds((prev) => {
        const next = new Set(prev);
        next.add(article.id);
        syncStateWithServer(undefined, next);
        return next;
      });
    }
    if (isMobile) {
      setMobilePane('reader');
    }
  };

  // A ranked digest story opens in the reader while it is still in the library,
  // and falls back to the publisher's page when it is not in the local cache.
  const handleSelectBriefingStory = (story: AIBriefingStory) => {
    const match = story.id ? articles.find((a) => a.id === story.id) : undefined;
    if (match) {
      handleSelectArticle(match);
      return;
    }
    if (story.link) {
      window.open(story.link, '_blank', 'noopener,noreferrer');
    }
  };

  // Folder and badge counts
  const unreadCountByFeed = useMemo(() => {
    const counts: Record<string, number> = {};
    const feedUrlToId = new Map(feeds.map((f) => [f.url, f.id]));

    articles.forEach((a) => {
      if (!deletedArticleIds.has(a.id) && !archivedArticleIds.has(a.id) && !readArticleIds.has(a.id)) {
        const feedId = feedUrlToId.get(a.feedUrl);
        if (feedId) {
          counts[feedId] = (counts[feedId] || 0) + 1;
        }
      }
    });
    return counts;
  }, [articles, feeds, readArticleIds, deletedArticleIds, archivedArticleIds]);

  const totalUnreadCount = useMemo(() => {
    return articles.filter((a) => !deletedArticleIds.has(a.id) && !archivedArticleIds.has(a.id) && !readArticleIds.has(a.id)).length;
  }, [articles, readArticleIds, deletedArticleIds, archivedArticleIds]);

  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return articles.filter((a) => !deletedArticleIds.has(a.id) && !archivedArticleIds.has(a.id) && !readArticleIds.has(a.id) && new Date(a.pubDate) >= today).length;
  }, [articles, readArticleIds, deletedArticleIds, archivedArticleIds]);

  const starredCount = starredArticleIds.size;
  const archivedCount = archivedArticleIds.size;

  const existingFolders = useMemo(() => {
    const set = new Set(feeds.map((f) => f.folder || DEFAULT_FOLDER));
    return Array.from(set);
  }, [feeds]);

  const undoMessage = pendingUndo
    ? pendingUndo.kind === 'delete'
      ? pendingUndo.entries.length === 1
        ? 'Article deleted'
        : `${pendingUndo.entries.length} articles deleted`
      : `${pendingUndo.ids.length} ${pendingUndo.ids.length === 1 ? 'article' : 'articles'} marked as read`
    : '';

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-black text-slate-100 font-sans selection:bg-[#0A84FF]/30 selection:text-white">
      {/* Offline Indicator Toast */}
      <OfflineIndicator />

      {/* Undo affordance for destructive actions */}
      {pendingUndo && (
        <UndoToast
          key={pendingUndo.id}
          message={undoMessage}
          onUndo={handleUndo}
          onDismiss={handleDismissUndo}
        />
      )}

      {/* Modals */}
      <AddFeedModal
        isOpen={isAddFeedOpen}
        onClose={() => setIsAddFeedOpen(false)}
        onFeedAdded={handleFeedAdded}
        onBulkFeedsAdded={handleBulkFeedsAdded}
        existingFolders={existingFolders}
        existingFeedUrls={feeds.map((f) => f.url)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        feeds={feeds}
        onDeleteFeed={handleDeleteFeed}
        onUpdateFeed={handleUpdateFeed}
        onImportComplete={() => {
          loadStoredData().then((f) => {
            if (f) refreshAllFeeds(f);
          });
        }}
      />

      {/* Desktop Layout: 3-Pane Side-by-Side (NetNewsWire) */}
      {!isMobile ? (
        <div className="flex flex-1 w-full h-full overflow-hidden">
          <Sidebar
            feeds={feeds}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            onRefreshAll={() => refreshAllFeeds()}
            isRefreshing={isRefreshing}
            onOpenAddFeed={() => setIsAddFeedOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenReader={() => {
              // On desktop, focus reader or select first article
              if (!selectedArticleId && displayedArticles.length > 0) {
                handleSelectArticle(displayedArticles[0]);
              }
            }}
            onDeleteFeed={handleDeleteFeed}
            onUpdateFeed={handleUpdateFeed}
            onRenameFolder={handleRenameFolder}
            unreadCountByFeed={unreadCountByFeed}
            totalUnreadCount={totalUnreadCount}
            todayCount={todayCount}
            starredCount={starredCount}
            archivedCount={archivedCount}
            lastUpdated={lastRefreshedAt}
            aiBriefing={aiBriefing}
            isGeneratingBriefing={isGeneratingBriefing}
            isBriefingExpanded={isBriefingExpanded}
            onGenerateBriefing={handleGenerateBriefing}
            onToggleBriefingCollapse={handleToggleBriefingCollapse}
            onDismissBriefing={handleDismissBriefing}
            onSelectBriefingStory={handleSelectBriefingStory}
          />

          <Timeline
            articles={displayedArticles}
            feeds={feeds}
            selectedArticleId={selectedArticleId}
            onSelectArticle={handleSelectArticle}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            readArticleIds={readArticleIds}
            starredArticleIds={starredArticleIds}
            archivedArticleIds={archivedArticleIds}
            onToggleStar={handleToggleStar}
            onDeleteArticle={handleDeleteArticle}
            onArchiveArticle={handleArchiveArticle}
            onUnarchiveArticle={handleUnarchiveArticle}
            onToggleRead={handleToggleRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onRefreshAll={() => refreshAllFeeds()}
            isRefreshing={isRefreshing}
            isMobile={false}
            onUpdateArticle={handleUpdateArticle}
            aiBriefing={aiBriefing}
            isGeneratingBriefing={isGeneratingBriefing}
            isBriefingExpanded={isBriefingExpanded}
            onGenerateBriefing={handleGenerateBriefing}
            onToggleBriefingCollapse={handleToggleBriefingCollapse}
            onDismissBriefing={handleDismissBriefing}
            onSelectBriefingStory={handleSelectBriefingStory}
          />

          <ArticleView
            article={selectedArticle}
            isStarred={selectedArticle ? starredArticleIds.has(selectedArticle.id) : false}
            isRead={selectedArticle ? readArticleIds.has(selectedArticle.id) : false}
            onToggleStar={() => selectedArticle && handleToggleStar(selectedArticle.id)}
            onToggleRead={() => selectedArticle && handleToggleRead(selectedArticle.id)}
            isMobile={false}
            hasPrevArticle={hasPrevArticle}
            hasNextArticle={hasNextArticle}
            onPrevArticle={handlePrevArticle}
            onNextArticle={handleNextArticle}
          />
        </div>
      ) : (
        /* Mobile / iPhone Drill-down Pane with Smooth iOS Sliding Screen Transitions */
        <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
          <div className="flex-1 w-full h-full overflow-hidden relative">
            <div
              className="flex w-full h-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
              style={{
                transform:
                  mobilePane === 'sidebar'
                    ? 'translateX(0%)'
                    : mobilePane === 'timeline'
                    ? 'translateX(-100%)'
                    : 'translateX(-200%)'
              }}
            >
              {/* Screen 1: Feeds & Navigation */}
              <div
                className={`w-full h-full shrink-0 basis-full flex flex-col transition-opacity duration-200 ${
                  mobilePane === 'sidebar' ? 'opacity-100 pointer-events-auto' : 'opacity-80 pointer-events-none'
                }`}
                aria-hidden={mobilePane !== 'sidebar'}
              >
                <Sidebar
                  feeds={feeds}
                  activeFilter={activeFilter}
                  onSelectFilter={(filter) => {
                    setActiveFilter(filter);
                    setMobilePane('timeline');
                  }}
                  onRefreshAll={() => refreshAllFeeds()}
                  isRefreshing={isRefreshing}
                  onOpenAddFeed={() => setIsAddFeedOpen(true)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenReader={() => {
                    if (!selectedArticleId && displayedArticles.length > 0) {
                      handleSelectArticle(displayedArticles[0]);
                    }
                    setMobilePane('reader');
                  }}
                  onDeleteFeed={handleDeleteFeed}
                  onUpdateFeed={handleUpdateFeed}
                  onRenameFolder={handleRenameFolder}
                  unreadCountByFeed={unreadCountByFeed}
                  totalUnreadCount={totalUnreadCount}
                  todayCount={todayCount}
                  starredCount={starredCount}
                  archivedCount={archivedCount}
                  lastUpdated={lastRefreshedAt}
                  isMobile={true}
                  aiBriefing={aiBriefing}
                  isGeneratingBriefing={isGeneratingBriefing}
                  isBriefingExpanded={isBriefingExpanded}
                  onGenerateBriefing={handleGenerateBriefing}
                  onToggleBriefingCollapse={handleToggleBriefingCollapse}
                  onDismissBriefing={handleDismissBriefing}
                  onSelectBriefingStory={handleSelectBriefingStory}
                />
              </div>

              {/* Screen 2: Articles Timeline */}
              <div
                className={`w-full h-full shrink-0 basis-full flex flex-col transition-opacity duration-200 ${
                  mobilePane === 'timeline' ? 'opacity-100 pointer-events-auto' : 'opacity-80 pointer-events-none'
                }`}
                aria-hidden={mobilePane !== 'timeline'}
              >
                <Timeline
                  articles={displayedArticles}
                  feeds={feeds}
                  selectedArticleId={selectedArticleId}
                  onSelectArticle={handleSelectArticle}
                  activeFilter={activeFilter}
                  onSelectFilter={setActiveFilter}
                  readArticleIds={readArticleIds}
                  starredArticleIds={starredArticleIds}
                  archivedArticleIds={archivedArticleIds}
                  onToggleStar={handleToggleStar}
                  onDeleteArticle={handleDeleteArticle}
                  onArchiveArticle={handleArchiveArticle}
                  onUnarchiveArticle={handleUnarchiveArticle}
                  onToggleRead={handleToggleRead}
                  onMarkAllAsRead={handleMarkAllAsRead}
                  onBackToFeeds={() => setMobilePane('sidebar')}
                  onRefreshAll={() => refreshAllFeeds()}
                  isRefreshing={isRefreshing}
                  isMobile={true}
                  onUpdateArticle={handleUpdateArticle}
                  aiBriefing={aiBriefing}
                  isGeneratingBriefing={isGeneratingBriefing}
                  isBriefingExpanded={isBriefingExpanded}
                  onGenerateBriefing={handleGenerateBriefing}
                  onToggleBriefingCollapse={handleToggleBriefingCollapse}
                  onDismissBriefing={handleDismissBriefing}
                  onSelectBriefingStory={handleSelectBriefingStory}
                />
              </div>

              {/* Screen 3: Article Story Reader */}
              <div
                className={`w-full h-full shrink-0 basis-full flex flex-col transition-opacity duration-200 ${
                  mobilePane === 'reader' ? 'opacity-100 pointer-events-auto' : 'opacity-80 pointer-events-none'
                }`}
                aria-hidden={mobilePane !== 'reader'}
              >
                <ArticleView
                  article={selectedArticle}
                  isStarred={selectedArticle ? starredArticleIds.has(selectedArticle.id) : false}
                  isRead={selectedArticle ? readArticleIds.has(selectedArticle.id) : false}
                  onToggleStar={() => selectedArticle && handleToggleStar(selectedArticle.id)}
                  onToggleRead={() => selectedArticle && handleToggleRead(selectedArticle.id)}
                  onBackToTimeline={() => setMobilePane('timeline')}
                  isMobile={true}
                  hasPrevArticle={hasPrevArticle}
                  hasNextArticle={hasNextArticle}
                  onPrevArticle={handlePrevArticle}
                  onNextArticle={handleNextArticle}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
