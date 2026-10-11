/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fallback folder for feeds that have not been filed by the user or the
 * categorizer. Sidebar grouping, Settings and the ServerSync paths must all
 * agree on this single name so one concept never appears under two labels.
 */
export const DEFAULT_FOLDER = 'Subscriptions';

export interface Feed {
  id: string;
  title: string;
  url: string;
  homeUrl?: string;
  folder?: string;
  tags?: string[];
  favicon?: string;
  lastFetched?: string | null;
  error?: string | null;
}

export interface Article {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  author: string;
  content: string;
  snippet: string;
  imageUrl?: string | null;
  feedTitle: string;
  feedUrl: string;
}

export interface ScrapedArticle {
  title?: string;
  leadImage?: string;
  author?: string;
  contentHtml: string;
  readingTimeMin: number;
  wordCount: number;
  url: string;
}

export type SmartViewType = 'today' | 'unread' | 'starred' | 'archive' | 'all' | 'feed' | 'folder' | 'tag';

export interface SmartFilter {
  type: SmartViewType;
  id?: string; // feedId or folder name
  title: string;
}

/** One ranked story inside a daily briefing. `id` (when present) maps back to
 * a stored Article so the digest can open it in the reader instead of a new tab. */
export interface AIBriefingStory {
  id?: string;
  title: string;
  feedTitle?: string;
  link?: string;
  pubDate?: string;
  /** One sentence on why this story matters — omitted by the non-Gemini fallback. */
  whyItMatters?: string;
}

/** A recurring subject across the day's stories. */
export interface AIBriefingTheme {
  label: string;
  description?: string;
  storyCount?: number;
}

/** The Morning Digest: one paragraph, the day's themes, and up to ten stories. */
export interface AIBriefing {
  paragraph: string;
  themes: AIBriefingTheme[];
  topStories: AIBriefingStory[];
  articlesCount: number;
  generatedAt: string;
  /** Local calendar day (YYYY-MM-DD) the digest belongs to; one digest per day. */
  date?: string;
  poweredBy?: string;
  source?: 'gemini' | 'fallback';
}
