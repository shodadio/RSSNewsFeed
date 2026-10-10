/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Feed, Article } from '../types';

// Storage keys with backward compatibility support
const KEYS = {
  FEEDS: 'rssnewsfeeds_feeds',
  LEGACY_FEEDS: 'nnw_feeds',
  READ_IDS: 'rssnewsfeeds_read_ids',
  LEGACY_READ_IDS: 'nnw_read_ids',
  STARRED_IDS: 'rssnewsfeeds_starred_ids',
  LEGACY_STARRED_IDS: 'nnw_starred_ids',
  ARCHIVED_IDS: 'rssnewsfeeds_archived_ids',
  LEGACY_ARCHIVED_IDS: 'nnw_archived_ids',
  DELETED_IDS: 'rssnewsfeeds_deleted_ids',
  LEGACY_DELETED_IDS: 'nnw_deleted_ids',
  DELETED_FEED_URLS: 'rssnewsfeeds_deleted_feed_urls',
  CACHED_ARTICLES: 'rssnewsfeeds_cached_articles',
  LEGACY_CACHED_ARTICLES: 'nnw_cached_articles',
  STORAGE_MODE: 'rssnewsfeeds_storage_mode',
  LEGACY_STORAGE_MODE: 'nnw_storage_mode',
  HAS_USER_DATA: 'rssnewsfeeds_has_user_data'
};

function safeGet(key: string, legacyKey?: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
    if (legacyKey) {
      const leg = localStorage.getItem(legacyKey);
      if (leg !== null) return leg;
    }
  } catch {
    // LocalStorage unavailable or in private mode
  }
  return null;
}

function safeSet(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch (e) {
    console.warn(`LocalStorage write error for ${key}:`, e);
  }
}

export function hasLocalUserData(): boolean {
  return safeGet(KEYS.HAS_USER_DATA) === 'true' || safeGet(KEYS.FEEDS) !== null || safeGet(KEYS.LEGACY_FEEDS) !== null;
}

export function getLocalFeeds(): Feed[] | null {
  const raw = safeGet(KEYS.FEEDS, KEYS.LEGACY_FEEDS);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse local feeds:', e);
  }
  return null;
}

export function getLocalDeletedFeedUrls(): Set<string> {
  const raw = safeGet(KEYS.DELETED_FEED_URLS);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {}
  return new Set();
}

export function saveLocalDeletedFeedUrls(deleted: Set<string>): void {
  try {
    safeSet(KEYS.DELETED_FEED_URLS, JSON.stringify(Array.from(deleted)));
  } catch (e) {
    console.error('Failed to save deleted feed URLs locally:', e);
  }
}

export function saveLocalFeeds(feeds: Feed[]): void {
  try {
    safeSet(KEYS.FEEDS, JSON.stringify(feeds));
    safeSet(KEYS.HAS_USER_DATA, 'true');
  } catch (e) {
    console.error('Failed to save local feeds:', e);
  }
}

export function getLocalArticleState(): {
  readArticleIds: Set<string>;
  starredArticleIds: Set<string>;
  archivedArticleIds: Set<string>;
  deletedArticleIds: Set<string>;
} {
  const parseSet = (key: string, legKey: string): Set<string> => {
    const raw = safeGet(key, legKey);
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    } catch {}
    return new Set();
  };

  return {
    readArticleIds: parseSet(KEYS.READ_IDS, KEYS.LEGACY_READ_IDS),
    starredArticleIds: parseSet(KEYS.STARRED_IDS, KEYS.LEGACY_STARRED_IDS),
    archivedArticleIds: parseSet(KEYS.ARCHIVED_IDS, KEYS.LEGACY_ARCHIVED_IDS),
    deletedArticleIds: parseSet(KEYS.DELETED_IDS, KEYS.LEGACY_DELETED_IDS)
  };
}

export function saveLocalArticleState(
  readArticleIds?: Set<string>,
  starredArticleIds?: Set<string>,
  archivedArticleIds?: Set<string>,
  deletedArticleIds?: Set<string>
): void {
  try {
    if (readArticleIds) {
      safeSet(KEYS.READ_IDS, JSON.stringify(Array.from(readArticleIds)));
    }
    if (starredArticleIds) {
      safeSet(KEYS.STARRED_IDS, JSON.stringify(Array.from(starredArticleIds)));
    }
    if (archivedArticleIds) {
      safeSet(KEYS.ARCHIVED_IDS, JSON.stringify(Array.from(archivedArticleIds)));
    }
    if (deletedArticleIds) {
      safeSet(KEYS.DELETED_IDS, JSON.stringify(Array.from(deletedArticleIds)));
    }
    safeSet(KEYS.HAS_USER_DATA, 'true');
  } catch (e) {
    console.error('Failed to save article states locally:', e);
  }
}

export function getLocalCachedArticles(): Article[] {
  const raw = safeGet(KEYS.CACHED_ARTICLES, KEYS.LEGACY_CACHED_ARTICLES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function saveLocalCachedArticles(articles: Article[]): void {
  try {
    // Keep top 600 latest articles to prevent exceeding quota
    safeSet(KEYS.CACHED_ARTICLES, JSON.stringify(articles.slice(0, 600)));
  } catch (e) {
    // Quota exceeded: slice to 200 and retry
    try {
      safeSet(KEYS.CACHED_ARTICLES, JSON.stringify(articles.slice(0, 200)));
    } catch {}
  }
}

export function getStorageMode(): 'iphone' | 'icloud' {
  const raw = safeGet(KEYS.STORAGE_MODE, KEYS.LEGACY_STORAGE_MODE);
  return (raw as 'iphone' | 'icloud') || 'iphone';
}

export function setStorageMode(mode: 'iphone' | 'icloud'): void {
  safeSet(KEYS.STORAGE_MODE, mode);
  safeSet(KEYS.LEGACY_STORAGE_MODE, mode);
}
