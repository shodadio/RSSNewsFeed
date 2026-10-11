/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_FOLDER } from '../types';

export interface CategorySuggestionResult {
  primaryCategory: string;
  suggestedCategories: string[];
  suggestedTags: string[];
  matchedKeywords: string[];
}

interface TaxonomyRule {
  category: string;
  tags: string[];
  keywords: string[];
  urlPatterns: RegExp[];
}

/**
 * Canonical folder taxonomy offered to classifiers (Gemini prompts, pickers).
 * Users may still create their own folders; this is the suggested vocabulary.
 */
export const CANONICAL_FOLDERS = [
  'AI & Machine Learning',
  'Tech & Architecture',
  'Developer News',
  'Indie Mac & Swift',
  'Design & UX',
  'Culture & Books',
  'Business & Startups',
  'Finance & Economics',
  'Science & Space',
  'News & World',
  'Gaming & Entertainment',
  'Food & Cooking',
  'Sports & Outdoors',
  'Cryptocurrencies'
];

interface CuratedFolderRule {
  /** Matches against the feed hostname (without a leading "www."). */
  host: RegExp;
  folder: string;
  tags?: string[];
}

const TAXONOMY_RULES: TaxonomyRule[] = [
  {
    category: 'AI & Machine Learning',
    tags: ['ai', 'machine-learning', 'frontier-ai', 'deep-learning', 'llm', 'research'],
    keywords: [
      'ai', 'artificial intelligence', 'deepmind', 'neural', 'machine learning', 'llm', 'gpt',
      'openai', 'anthropic', 'transformer', 'frontier', 'diffusion', 'gemini', 'demis',
      'hassabis', 'agent', 'reinforcement learning', 'computer vision', 'nlp', 'embedding'
    ],
    urlPatterns: [/deepmind/i, /openai/i, /anthropic/i, /ai\b/i, /huggingface/i]
  },
  {
    category: 'Indie Mac & Swift',
    tags: ['apple', 'macos', 'ios', 'swift', 'indie-mac', 'xcode'],
    keywords: [
      'apple', 'mac', 'macos', 'ios', 'iphone', 'ipad', 'swift', 'swiftui', 'xcode',
      'cocoa', 'appkit', 'brent simmons', 'john gruber', 'daring fireball', 'inessential',
      'visionos', 'wwdc', 'core data', 'catalyst'
    ],
    urlPatterns: [/inessential/i, /daringfireball/i, /macrumors/i, /9to5mac/i, /swift\.org/i, /apple/i]
  },
  {
    category: 'Tech & Architecture',
    tags: ['tech', 'software', 'programming', 'architecture', 'engineering'],
    keywords: [
      'software', 'developer', 'engineering', 'architecture', 'database', 'sqlite', 'postgres',
      'python', 'rust', 'javascript', 'typescript', 'react', 'linux', 'code', 'api', 'backend',
      'frontend', 'distributed systems', 'cloud', 'simon willison', 'hacker news', 'golang'
    ],
    urlPatterns: [/github/i, /ycombinator/i, /simonwillison/i, /arstechnica/i, /theverge/i, /stackoverflow/i, /techcrunch/i]
  },
  {
    category: 'Design & UI/UX',
    tags: ['design', 'ui', 'ux', 'typography', 'creative'],
    keywords: [
      'design', 'ui', 'ux', 'figma', 'typography', 'css', 'interface', 'aesthetic', 'layout',
      'graphic design', 'product design', 'user experience', 'visual design', 'font', 'animation'
    ],
    urlPatterns: [/dribbble/i, /behance/i, /figma/i, /design/i, /alistapart/i, /smashingmagazine/i]
  },
  {
    category: 'Business & Startups',
    tags: ['business', 'startups', 'venture', 'finance', 'economy'],
    keywords: [
      'startup', 'startups', 'business', 'venture', 'vc', 'market', 'economy', 'revenue',
      'investing', 'founder', 'valuation', 'ipo', 'saas', 'growth', 'fundraising', 'enterprise'
    ],
    urlPatterns: [/bloomberg/i, /wsj/i, /forbes/i, /stratechery/i, /venture/i, /techcrunch/i]
  },
  {
    category: 'Science & Research',
    tags: ['science', 'research', 'physics', 'space', 'biology'],
    keywords: [
      'science', 'physics', 'biology', 'quantum', 'space', 'nasa', 'astronomy', 'paper',
      'research', 'genetics', 'chemistry', 'scientific', 'nature', 'experiment', 'climate', 'lab'
    ],
    urlPatterns: [/nature\.com/i, /arxiv\.org/i, /nasa\.gov/i, /science\.org/i, /phys\.org/i]
  },
  {
    category: 'Gaming & Culture',
    tags: ['gaming', 'games', 'entertainment', 'culture'],
    keywords: [
      'game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'esports', 'rpg',
      'multiplayer', 'indie game', 'game dev', 'unity', 'unreal', 'gameplay'
    ],
    urlPatterns: [/ign\.com/i, /polygon\.com/i, /kotaku/i, /eurogamer/i, /gamespot/i]
  },
  {
    category: 'News & Current Affairs',
    tags: ['news', 'world', 'politics', 'policy', 'journalism'],
    keywords: [
      'news', 'world', 'politics', 'policy', 'government', 'investigative', 'journalism',
      'global', 'report', 'election', 'court', 'international', 'diplomacy', 'editorial'
    ],
    urlPatterns: [/bbc\./i, /reuters\./i, /apnews\./i, /nytimes\./i, /theguardian\./i]
  }
];

/**
 * Curated publication -> folder overrides.
 *
 * A publication's *dominant* subject is not always discoverable from its feed
 * title/description keywords: a Substack whose blurb reads "deeply researched
 * interviews" scores as culture/books, and Substack exposes no usable category
 * metadata of its own. For a small set of well-known publications we pin the
 * folder explicitly. These take precedence over keyword scoring.
 *
 * Keep this list short and high-confidence; the user can always move a feed.
 */
const CURATED_FOLDER_OVERRIDES: CuratedFolderRule[] = [
  { host: /(^|\.)dwarkesh\.(com|substack\.com)$/i, folder: 'AI & Machine Learning', tags: ['ai', 'interviews'] },
  { host: /(^|\.)simonwillison\.net$/i, folder: 'AI & Machine Learning', tags: ['ai', 'llm', 'python'] },
  { host: /(^|\.)openai\.com$/i, folder: 'AI & Machine Learning', tags: ['ai', 'llm'] },
  { host: /(^|\.)anthropic\.com$/i, folder: 'AI & Machine Learning', tags: ['ai', 'llm'] },
  { host: /(^|\.)deepmind\.(com|google)$/i, folder: 'AI & Machine Learning', tags: ['ai', 'research'] },
  { host: /(^|\.)huggingface\.co$/i, folder: 'AI & Machine Learning', tags: ['ai', 'open-source'] },
  { host: /(^|\.)daringfireball\.net$/i, folder: 'Indie Mac & Swift', tags: ['apple', 'mac'] },
  { host: /(^|\.)inessential\.com$/i, folder: 'Indie Mac & Swift', tags: ['mac', 'ios', 'swift'] },
  { host: /(^|\.)9to5mac\.com$/i, folder: 'Indie Mac & Swift', tags: ['apple', 'mac'] },
  { host: /(^|\.)macrumors\.com$/i, folder: 'Indie Mac & Swift', tags: ['apple', 'mac'] },
  { host: /(^|\.)swift\.org$/i, folder: 'Indie Mac & Swift', tags: ['swift'] },
  { host: /(^|\.)hackingwithswift\.com$/i, folder: 'Indie Mac & Swift', tags: ['swift', 'swiftui'] },
  { host: /(^|\.)stratechery\.com$/i, folder: 'Tech & Architecture', tags: ['strategy', 'business'] },
  { host: /(^|\.)github\.blog$/i, folder: 'Tech & Architecture', tags: ['open-source', 'development'] },
  { host: /(^|\.)nature\.com$/i, folder: 'Science & Space', tags: ['science', 'research'] },
  { host: /(^|\.)nasa\.gov$/i, folder: 'Science & Space', tags: ['space', 'astronomy'] }
];

/** Returns the pinned folder + tags for a known publication host, if any. */
export function getCuratedFolder(
  url: string = ''
): { folder: string; tags: string[] } | null {
  const host = extractHostname(url);
  if (!host) return null;
  for (const rule of CURATED_FOLDER_OVERRIDES) {
    if (rule.host.test(host)) {
      return { folder: rule.folder, tags: rule.tags || [] };
    }
  }
  return null;
}

function extractHostname(url: string): string {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function slugifyCategory(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function suggestCategoriesAndTags(
  url: string = '',
  title: string = '',
  description: string = '',
  items: Array<{ title?: string; snippet?: string; content?: string }> = [],
  /**
   * Author/publisher-declared categories from the feed itself (RSS/Atom
   * <category> elements and iTunes categories). These are an explicit signal
   * and are weighted above incidental keyword matches.
   */
  authorCategories: string[] = []
): CategorySuggestionResult {
  const cleanUrl = url.toLowerCase().trim();
  const cleanTitle = title.toLowerCase().trim();
  const cleanDesc = description.toLowerCase().trim();

  // Combine items content for analysis
  const itemsText = items
    .slice(0, 8)
    .map((item) => `${item.title || ''} ${item.snippet || ''} ${item.content || ''}`)
    .join(' ')
    .toLowerCase();

  const fullCorpus = `${cleanUrl} ${cleanTitle} ${cleanDesc} ${itemsText}`;

  // Deduplicate and normalise the author-provided category strings
  const cleanAuthorCategories = Array.from(
    new Set(authorCategories.map((c) => String(c || '').trim()).filter(Boolean))
  );
  const authorText = cleanAuthorCategories.join(' ').toLowerCase();

  // Evaluate candidate scores
  const categoryScores: Array<{
    category: string;
    score: number;
    tags: string[];
    matchedKeywords: string[];
  }> = [];

  for (const rule of TAXONOMY_RULES) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Check URL patterns
    for (const pattern of rule.urlPatterns) {
      if (pattern.test(cleanUrl)) {
        score += 8; // Strong URL cue
      }
    }

    // Check keywords in full corpus
    for (const kw of rule.keywords) {
      // Word boundary regex
      const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(fullCorpus)) {
        matchedKeywords.push(kw);
        // Greater weight if in title or URL
        if (cleanTitle.includes(kw) || cleanUrl.includes(kw)) {
          score += 5;
        } else {
          score += 2;
        }
      }
    }

    // Author-declared categories are explicit: match them against the same
    // keyword vocabulary but with a stronger weight.
    if (authorText) {
      for (const kw of rule.keywords) {
        const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(authorText)) {
          if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
          score += 6;
        }
      }
    }

    if (score > 0) {
      categoryScores.push({
        category: rule.category,
        score,
        tags: rule.tags,
        matchedKeywords
      });
    }
  }

  // Sort descending by score
  categoryScores.sort((a, b) => a.score === b.score ? 0 : b.score - a.score);

  // Extract structural tags based on domain & URL format
  const derivedTags = new Set<string>();

  if (cleanUrl.includes('substack.com')) {
    derivedTags.add('newsletter');
    derivedTags.add('substack');
    // Extract author username or publication subdomain
    const subMatch = cleanUrl.match(/(?:@([a-zA-Z0-9_-]+)|([a-zA-Z0-9_-]+)\.substack\.com)/i);
    const subName = subMatch ? (subMatch[1] || subMatch[2]) : null;
    if (subName && !['www', 'feed', 'api', 'on'].includes(subName.toLowerCase())) {
      derivedTags.add(subName.toLowerCase());
    }
  }

  if (cleanUrl.includes('medium.com')) {
    derivedTags.add('blog');
    derivedTags.add('medium');
  }

  if (cleanUrl.includes('youtube.com')) {
    derivedTags.add('video');
    derivedTags.add('youtube');
  }

  if (cleanUrl.includes('github.com')) {
    derivedTags.add('open-source');
    derivedTags.add('code');
  }

  // Add domain name token as tag
  try {
    const domainHost = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`).hostname;
    const parts = domainHost.replace(/^www\./, '').split('.');
    if (parts[0] && parts[0].length > 2 && !['feed', 'rss', 'blog'].includes(parts[0])) {
      derivedTags.add(parts[0]);
    }
  } catch {
    // ignore
  }

  // Carry author-declared categories through as tags too
  for (const cat of cleanAuthorCategories.slice(0, 8)) {
    const slug = slugifyCategory(cat);
    if (slug && slug.length > 1) derivedTags.add(slug);
  }

  // Compile top categories and tags
  let suggestedCategories: string[] = [];
  const topMatchedKeywords: string[] = [];

  for (const cat of categoryScores.slice(0, 3)) {
    suggestedCategories.push(cat.category);
    cat.tags.forEach((t) => derivedTags.add(t));
    topMatchedKeywords.push(...cat.matchedKeywords);
  }

  // A curated override always wins for the primary folder, but we keep the
  // keyword-derived candidates as secondary suggestions.
  const curated = getCuratedFolder(url);
  if (curated) {
    suggestedCategories = [curated.folder, ...suggestedCategories.filter((c) => c !== curated.folder)];
    curated.tags.forEach((t) => derivedTags.add(t));
  }

  // Fallback defaults if no specific score
  if (suggestedCategories.length === 0) {
    if (cleanUrl.includes('substack')) {
      suggestedCategories.push('Newsletters');
    } else {
      suggestedCategories.push(DEFAULT_FOLDER);
    }
    derivedTags.add('rss');
  }

  const primaryCategory = curated ? curated.folder : (suggestedCategories[0] || DEFAULT_FOLDER);

  return {
    primaryCategory,
    suggestedCategories: Array.from(new Set(suggestedCategories)),
    suggestedTags: Array.from(derivedTags).slice(0, 6),
    matchedKeywords: Array.from(new Set(topMatchedKeywords)).slice(0, 5)
  };
}
