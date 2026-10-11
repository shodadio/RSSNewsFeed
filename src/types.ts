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

export interface UserSession {
  email: string;
  token: string;
  isAuthenticated: boolean;
}

export interface AIBriefingBullet {
  headline: string;
  summary: string;
  feedTitle?: string;
}

export interface AIBriefing {
  executiveSummary: string;
  bulletPoints: AIBriefingBullet[];
  articlesCount: number;
  generatedAt: string;
  poweredBy?: string;
}
