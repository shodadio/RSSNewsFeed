/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const META_TAGS = new Set([
  'substack',
  'newsletter',
  'rss',
  'feed',
  'blogs',
  'blog',
  'tech',
  'recommended',
  'article',
  'articles',
  'news'
]);

export function formatTag(rawTag: string): string {
  if (!rawTag) return '';
  const cleaned = rawTag.replace(/^#+/, '').replace(/[-_]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function isMetaTag(rawTag: string): boolean {
  if (!rawTag) return true;
  const slug = rawTag.toLowerCase().replace(/^#+/, '').replace(/[-_]+/g, '').trim();
  return META_TAGS.has(slug);
}
