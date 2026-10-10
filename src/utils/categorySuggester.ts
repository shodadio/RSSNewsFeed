/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export function suggestCategoriesAndTags(
  url: string = '',
  title: string = '',
  description: string = '',
  items: Array<{ title?: string; snippet?: string; content?: string }> = []
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
  categoryScores.sort((a, b) => b.score - a.score);

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

  // Compile top categories and tags
  const suggestedCategories: string[] = [];
  const topMatchedKeywords: string[] = [];

  for (const cat of categoryScores.slice(0, 3)) {
    suggestedCategories.push(cat.category);
    cat.tags.forEach((t) => derivedTags.add(t));
    topMatchedKeywords.push(...cat.matchedKeywords);
  }

  // Fallback defaults if no specific score
  if (suggestedCategories.length === 0) {
    if (cleanUrl.includes('substack')) {
      suggestedCategories.push('Newsletters');
    } else {
      suggestedCategories.push('Subscriptions');
    }
    derivedTags.add('rss');
  }

  const primaryCategory = suggestedCategories[0] || 'Subscriptions';

  return {
    primaryCategory,
    suggestedCategories: Array.from(new Set(suggestedCategories)),
    suggestedTags: Array.from(derivedTags).slice(0, 6),
    matchedKeywords: Array.from(new Set(topMatchedKeywords)).slice(0, 5)
  };
}
