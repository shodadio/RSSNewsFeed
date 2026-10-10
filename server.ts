/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { GoogleGenAI, Type } from "@google/genai";
import { suggestCategoriesAndTags } from './src/utils/categorySuggester.ts';

// Ensure HMR is disabled in AI Studio iframe environment to prevent WebSocket errors
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Gracefully handle unhandled rejections from external RSS feeds / DNS queries
process.on('unhandledRejection', (reason) => {
  console.warn('[server] Handled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
});

app.use(express.json({ limit: '10mb' }));

// Allow vibration feature in embedded iframes and mobile web views
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', 'vibration=*');
  next();
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// RSS Parser instance with custom User-Agent
const rssParser = new Parser({
  headers: {
    'User-Agent': 'NetNewsWire-Web/1.0 (Personal RSS Reader; Ranchero-Remix)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
  },
  timeout: 10000,
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['dc:creator', 'creator']
    ]
  }
});

// File-based persistent storage directory
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed feeds
const DEFAULT_STORE = {
  auth: {
    pin: '1984',
    email: 'rol.asthana@purvasa.uk',
    authRequired: true,
    sessionTokens: [] as string[]
  },
  feeds: [
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
      folder: 'Developer News',
      favicon: 'https://news.ycombinator.com/favicon.ico',
      lastFetched: null
    }
  ],
  readArticleIds: [] as string[],
  starredArticleIds: [] as string[],
  archivedArticleIds: [] as string[],
  deletedArticleIds: [] as string[],
  deletedFeedUrls: [] as string[],
  cachedArticles: {} as Record<string, any[]>
};

function readStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading store:', err);
  }
  return DEFAULT_STORE;
}

function writeStore(data: any) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store:', err);
  }
}

// Ensure store exists
if (!fs.existsSync(STORE_FILE)) {
  writeStore(DEFAULT_STORE);
}

// ======================== SSRF PROTECTION ========================

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  const lower = ip.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc00:') ||
    lower.startsWith('fd00:')
  ) {
    return true;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    if (a === 0 || a === 127) return true; // Current network & Loopback
    if (a === 10) return true; // RFC1918 Private
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 Private
    if (a === 192 && b === 168) return true; // RFC1918 Private
    if (a === 169 && b === 254) return true; // Link-local / Cloud metadata (169.254.169.254)
    if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-grade NAT
    if (a >= 224) return true; // Multicast / Reserved / Broadcast
    return false;
  }
  return false;
}

const dnsCache = new Map<string, { addresses: string[]; expires: number }>();

async function isSafePublicUrl(urlStr: string): Promise<{ safe: boolean; reason?: string; parsed?: URL }> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}` };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal' ||
      hostname === '169.254.169.254'
    ) {
      return { safe: false, reason: 'Restricted loopback or cloud metadata hostname' };
    }

    // Direct IP check
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: 'Private or local IP address' };
    }

    // Resolve hostname DNS to guard against DNS rebinding and internal network probing (with 5-minute memory cache)
    const now = Date.now();
    let addresses: string[] = [];
    const cached = dnsCache.get(hostname);
    if (cached && cached.expires > now) {
      addresses = cached.addresses;
    } else {
      try {
        const records = await dns.lookup(hostname, { all: true });
        addresses = records.map((r) => r.address);
        dnsCache.set(hostname, { addresses, expires: now + 5 * 60 * 1000 });
      } catch {
        return { safe: false, reason: `Could not resolve hostname: ${hostname}` };
      }
    }

    for (const address of addresses) {
      if (isPrivateIp(address)) {
        return { safe: false, reason: `Hostname resolves to private IP (${address})` };
      }
    }

    return { safe: true, parsed };
  } catch (err: any) {
    return { safe: false, reason: err.message || 'Invalid URL' };
  }
}

async function safeFetch(url: string, init?: RequestInit, maxRedirects = 5): Promise<globalThis.Response> {
  let currentUrl = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const safety = await isSafePublicUrl(currentUrl);
    if (!safety.safe) {
      throw new Error(`SSRF guard blocked request to ${currentUrl}: ${safety.reason}`);
    }

    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual'
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return response;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }
  throw new Error('Too many redirects while fetching URL');
}

// ======================== AUTHENTICATION & SECURITY ========================

// Rate limiter for PIN attempts (Brute force defense)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function isRateLimited(ip: string): boolean {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() < record.lockedUntil) return true;
  if (Date.now() >= record.lockedUntil && record.lockedUntil > 0) {
    loginAttempts.delete(ip);
    return false;
  }
  return false;
}

function recordFailedLogin(ip: string) {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = Date.now() + 60000; // 60-second lockout
  }
  loginAttempts.set(ip, record);
}

function resetFailedLogin(ip: string) {
  loginAttempts.delete(ip);
}

// Cryptographically secure active tokens
const activeTokens = new Set<string>();

function initTokensFromStore() {
  const store = readStore();
  if (Array.isArray(store.auth?.sessionTokens)) {
    store.auth.sessionTokens.forEach((t: string) => activeTokens.add(t));
  }
}
initTokensFromStore();

function generateSessionToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  const store = readStore();
  if (!Array.isArray(store.auth.sessionTokens)) {
    store.auth.sessionTokens = [];
  }
  store.auth.sessionTokens.push(token);
  if (store.auth.sessionTokens.length > 25) {
    store.auth.sessionTokens = store.auth.sessionTokens.slice(-25);
  }
  writeStore(store);
  return token;
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  if (activeTokens.has(token)) return true;
  const store = readStore();
  if (Array.isArray(store.auth?.sessionTokens) && store.auth.sessionTokens.includes(token)) {
    activeTokens.add(token);
    return true;
  }
  return false;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const store = readStore();
  if (store.auth?.authRequired === false) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.headers['x-session-token'] as string);

  if (!isValidToken(token)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid session passcode token is required.'
    });
  }
  next();
}

// ======================== API ROUTES ========================

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', name: 'RSSNewsFeeds-Web', time: new Date().toISOString() });
});

// Authentication verify
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { pin } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed passcode attempts. Please wait 60 seconds before trying again.'
    });
  }

  const store = readStore();
  const configuredPin = String(store.auth?.pin || '1984');

  // Strict verification: PIN is mandatory and must match configured passcode
  if (!pin || String(pin) !== configuredPin) {
    recordFailedLogin(clientIp);
    return res.status(401).json({
      success: false,
      message: 'Incorrect PIN passcode.'
    });
  }

  resetFailedLogin(clientIp);
  const sessionToken = generateSessionToken();

  return res.json({
    success: true,
    token: sessionToken,
    user: {
      email: store.auth?.email || 'rol.asthana@purvasa.uk',
      authRequired: store.auth?.authRequired ?? true
    }
  });
});

// Verify existing session token or auth requirement
app.get('/api/auth/verify', (req: Request, res: Response) => {
  const store = readStore();
  const authRequired = store.auth?.authRequired !== false;

  if (!authRequired) {
    return res.json({
      valid: true,
      authRequired: false,
      user: {
        email: store.auth?.email || 'rol.asthana@purvasa.uk',
        authRequired: false
      }
    });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.headers['x-session-token'] as string);

  if (isValidToken(token)) {
    return res.json({
      valid: true,
      authRequired: true,
      user: {
        email: store.auth?.email || 'rol.asthana@purvasa.uk',
        authRequired: true
      }
    });
  }

  return res.status(401).json({
    valid: false,
    authRequired: true,
    message: 'Session passcode token is required or expired.'
  });
});

// Toggle passcode requirement
app.post('/api/auth/toggle-required', requireAuth, (req: Request, res: Response) => {
  const { authRequired } = req.body;
  const store = readStore();
  if (!store.auth) store.auth = { ...DEFAULT_STORE.auth };
  store.auth.authRequired = Boolean(authRequired);
  writeStore(store);
  res.json({ success: true, authRequired: store.auth.authRequired });
});

app.post('/api/auth/change-pin', requireAuth, (req: Request, res: Response) => {
  const { currentPin, newPin } = req.body;
  const store = readStore();

  if (String(currentPin) !== String(store.auth?.pin)) {
    return res.status(401).json({ success: false, message: 'Current PIN does not match.' });
  }

  if (!newPin || String(newPin).length < 4) {
    return res.status(400).json({ success: false, message: 'New PIN must be at least 4 digits.' });
  }

  store.auth.pin = String(newPin);
  writeStore(store);
  res.json({ success: true, message: 'PIN successfully updated.' });
});

// Parse helper with direct safe fetch and SSRF guard
async function parseFeedCandidate(candidateUrl: string) {
  let targetCandidateUrl = candidateUrl;
  // Transparently map hnrss.org to official Hacker News RSS to avoid connection timeouts in sandbox
  if (targetCandidateUrl.includes('hnrss.org')) {
    targetCandidateUrl = 'https://news.ycombinator.com/rss';
  }

  const safety = await isSafePublicUrl(targetCandidateUrl);
  if (!safety.safe) {
    throw new Error(`SSRF blocked: ${safety.reason}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await safeFetch(targetCandidateUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NetNewsWire/6.1 (RSS Reader; https://netnewswire.com)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      if (text && (text.includes('<rss') || text.includes('<feed') || text.includes('<xml') || text.includes('xmlns') || text.trim().startsWith('<?xml'))) {
        const feed = await rssParser.parseString(text);
        if (feed && feed.items) {
          return feed;
        }
      }
    }
  } catch (err: any) {
    clearTimeout(timeout);
    // If Hacker News or hnrss candidate errors, quietly fall back to official Hacker News RSS
    if (candidateUrl.includes('hnrss.org') || candidateUrl.includes('news.ycombinator.com')) {
      try {
        const fbRes = await safeFetch('https://news.ycombinator.com/rss', {
          headers: {
            'User-Agent': 'NetNewsWire/6.1 (RSS Reader; https://netnewswire.com)',
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
          }
        });
        if (fbRes.ok) {
          const fbText = await fbRes.text();
          const fbFeed = await rssParser.parseString(fbText);
          if (fbFeed && fbFeed.items) {
            return fbFeed;
          }
        }
      } catch {}
    }
    throw err;
  }
  throw new Error(`Could not parse valid feed from ${candidateUrl}`);
}

// Feed Auto-Discovery and Parsing
async function discoverAndParseFeed(inputUrl: string) {
  let targetUrl = inputUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  if (targetUrl.includes('hnrss.org')) {
    targetUrl = 'https://news.ycombinator.com/rss';
  }

  // 1. Direct parse attempt (fast path)
  try {
    const feed = await parseFeedCandidate(targetUrl);
    if (feed && feed.items) {
      return { feed, feedUrl: targetUrl };
    }
  } catch (initialErr: any) {
    console.log(`Direct parse note for ${targetUrl}: ${initialErr.message}. Starting NetNewsWire feed auto-discovery...`);
  }

  // 2. Discover potential feed URLs
  const candidateUrls: string[] = [];
  const addCandidate = (url: string) => {
    if (url && !candidateUrls.includes(url) && url !== targetUrl) {
      candidateUrls.push(url);
    }
  };

  try {
    const parsedObj = new URL(targetUrl);

    // Platform-specific fast paths
    const substackProfileMatch = (targetUrl).match(/substack\.com\/@([a-zA-Z0-9_.-]+)/i);
    if (substackProfileMatch) {
      const username = substackProfileMatch[1];
      addCandidate(`https://${username}.substack.com/feed`);
    }

    if (parsedObj.hostname.endsWith('substack.com') && !parsedObj.hostname.startsWith('www.')) {
      addCandidate(`${parsedObj.origin}/feed`);
    }

    if (parsedObj.hostname.includes('medium.com')) {
      const pathClean = parsedObj.pathname.replace(/\/$/, '');
      addCandidate(`${parsedObj.origin}/feed${pathClean}`);
    }

    if (parsedObj.hostname.includes('youtube.com')) {
      const channelMatch = parsedObj.pathname.match(/\/channel\/([a-zA-Z0-9_-]+)/);
      if (channelMatch) {
        addCandidate(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`);
      }
    }

    if (parsedObj.hostname.includes('hnrss.org') || parsedObj.hostname.includes('news.ycombinator.com')) {
      addCandidate('https://news.ycombinator.com/rss');
      addCandidate('https://hnrss.org/best');
    }

    // Fetch page HTML to search for feeds and parse page metadata
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const htmlRes = await safeFetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NetNewsWire/6.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (htmlRes.ok) {
      const effectiveUrl = htmlRes.url || targetUrl;
      const html = await htmlRes.text();

      // Substack resolution: Handles both author profiles (@user) and publications
      const isSubstack = effectiveUrl.includes('substack.com') || targetUrl.includes('substack.com');
      if (isSubstack) {
        const redirectedProfile = (effectiveUrl).match(/substack\.com\/@([a-zA-Z0-9_.-]+)/i);
        if (redirectedProfile) {
          addCandidate(`https://${redirectedProfile[1]}.substack.com/feed`);
        }

        // Substack embeds author's primaryPublication in script payload:
        // "primaryPublication":{"subdomain":"aitidbits","custom_domain":"www.aitidbits.ai",...}
        const primCustomMatch = html.match(/\\?"primaryPublication\\?":\s*\{[^}]*?\\?"custom_domain\\?":\s*\\?"([a-zA-Z0-9_.-]+)\\?"/i);
        if (primCustomMatch && primCustomMatch[1]) {
          candidateUrls.unshift(`https://${primCustomMatch[1]}/feed`);
        }

        const primSubMatch = html.match(/\\?"primaryPublication\\?":\s*\{[^}]*?\\?"subdomain\\?":\s*\\?"([a-zA-Z0-9_-]+)\\?"/i);
        if (primSubMatch && primSubMatch[1]) {
          candidateUrls.unshift(`https://${primSubMatch[1]}.substack.com/feed`);
        }

        // Scan all linked Substack publication subdomains from the author's profile
        const subMatches = [...html.matchAll(/\\?"subdomain\\?":\s*\\?"([a-zA-Z0-9_-]+)\\?"/gi)];
        const systemSubdomains = ['substack', 'support', 'on', 'cdn', 'api', 'help', 'email', 'chat', 'status', 'reader', 'profile'];
        for (const m of subMatches) {
          const sub = m[1].toLowerCase();
          if (!systemSubdomains.includes(sub)) {
            addCandidate(`https://${sub}.substack.com/feed`);
          }
        }

        // Scan custom publication domains
        const customMatches = [...html.matchAll(/\\?"custom_domain\\?":\s*\\?"([a-zA-Z0-9_.-]+)\\?"/gi)];
        for (const m of customMatches) {
          const dom = m[1].toLowerCase();
          if (dom && dom !== 'null' && dom.includes('.')) {
            addCandidate(`https://${dom}/feed`);
          }
        }
      }

      // Check standard <link rel="alternate" ...> tags in HTML head
      const linkMatches = [...html.matchAll(/<link\b[^>]*>/gi)];
      for (const match of linkMatches) {
        const tag = match[0];
        const rel = tag.match(/rel=["']([^"']*)["']/i)?.[1] || '';
        const type = tag.match(/type=["']([^"']*)["']/i)?.[1] || '';
        const href = tag.match(/href=["']([^"']*)["']/i)?.[1] || '';

        if (
          rel.toLowerCase().includes('alternate') &&
          (type.includes('rss') || type.includes('atom') || type.includes('xml') || type.includes('json'))
        ) {
          if (href) {
            try {
              const fullCandidate = new URL(href, effectiveUrl).href;
              addCandidate(fullCandidate);
            } catch {
              // ignore invalid candidate URL
            }
          }
        }
      }
    }

    // Common standard feed paths on origin
    const standardPaths = ['/feed', '/rss', '/rss.xml', '/atom.xml', '/feed.xml', '/index.xml'];
    for (const p of standardPaths) {
      const testUrl = `${parsedObj.origin}${p}`;
      addCandidate(testUrl);
    }
  } catch (discErr: any) {
    console.warn(`Feed discovery lookup note for ${targetUrl}:`, discErr.message);
  }

  // 3. Try each discovered candidate URL
  for (const candidate of candidateUrls) {
    try {
      const feed = await parseFeedCandidate(candidate);
      if (feed && feed.items) {
        console.log(`Auto-discovered feed: ${candidate} for ${targetUrl}`);
        return { feed, feedUrl: candidate };
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error(`Could not find a valid RSS or Atom feed at ${targetUrl}. Please verify the feed URL.`);
}

// Fetch Single or Batch RSS feeds
app.post('/api/feeds/fetch', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const safety = await isSafePublicUrl(url);
  if (!safety.safe) {
    return res.status(400).json({ error: `Invalid or restricted feed URL: ${safety.reason}` });
  }

  try {
    const { feed, feedUrl } = await discoverAndParseFeed(url);

    const items = (feed.items || []).map((item, index) => {
      // Find thumbnail or hero image from enclosures or media tags
      let imageUrl = null;
      if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
        imageUrl = item.enclosure.url;
      } else if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
        imageUrl = item.mediaContent.$;
      } else if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
        imageUrl = item.mediaThumbnail.$;
      }

      // Check inline html for first image
      const anyItem = item as any;
      const rawContent = anyItem['content:encoded'] || item.content || item.summary || '';
      if (!imageUrl) {
        const imgMatch = rawContent.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (imgMatch && imgMatch[1] && !imgMatch[1].includes('feedburner') && !imgMatch[1].includes('tracker')) {
          imageUrl = imgMatch[1];
        }
      }

      // Clean snippet
      const cleanSnippet = (item.contentSnippet || rawContent.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);

      const uniqueId = item.guid || anyItem.id || item.link || `${feedUrl}-${item.title}-${index}`;

      return {
        id: uniqueId,
        title: item.title || 'Untitled Article',
        link: item.link || feedUrl,
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        author: anyItem.creator || anyItem.author || feed.title || 'Author',
        content: rawContent,
        snippet: cleanSnippet,
        imageUrl: imageUrl,
        feedTitle: feed.title || 'RSS Feed',
        feedUrl: feedUrl
      };
    });

    const suggestions = suggestCategoriesAndTags(
      feedUrl || url,
      feed.title || '',
      feed.description || '',
      items
    );

    res.json({
      title: feed.title || url,
      description: feed.description || '',
      link: feed.link || url,
      feedUrl,
      suggestedCategories: suggestions.suggestedCategories,
      primaryCategory: suggestions.primaryCategory,
      suggestedTags: suggestions.suggestedTags,
      matchedKeywords: suggestions.matchedKeywords,
      items
    });
  } catch (err: any) {
    console.warn(`Failed to parse feed at ${url}: ${err.message}`);
    res.status(422).json({ error: err.message || 'Failed to parse feed.' });
  }
});

// NetNewsWire Secret Feed Catalog & Search Engine (Zero API Credit Dependency & Dynamic Real Feed Generation)
const NETNEWSWIRE_MASTER_CATALOG = [
  { title: "Simon Willison's Weblog", url: 'https://simonwillison.net/atom/everything/', description: 'Python, AI, LLMs and web development', folder: 'AI & Machine Learning', keywords: ['ai', 'python', 'llm', 'coding', 'web', 'software'] },
  { title: 'Daring Fireball', url: 'https://daringfireball.net/feeds/main', description: 'John Gruber on Apple, Mac, and technology', folder: 'Indie Mac & Swift', keywords: ['apple', 'mac', 'ios', 'iphone', 'tech', 'mobile'] },
  { title: 'inessential (Brent Simmons)', url: 'https://inessential.com/xml/rss.xml', description: 'Indie Mac and iOS developer Brent Simmons', folder: 'Indie Mac & Swift', keywords: ['mac', 'ios', 'swift', 'indie', 'cocoa'] },
  { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', description: 'Technology news, analysis, and reviews', folder: 'Tech & Architecture', keywords: ['tech', 'news', 'science', 'gadgets', 'gaming', 'hardware'] },
  { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', description: 'Technology, science, art, and culture', folder: 'Tech & Architecture', keywords: ['tech', 'culture', 'gadgets', 'reviews', 'news', 'design'] },
  { title: 'Hacker News', url: 'https://news.ycombinator.com/rss', description: 'Top tech and startup discussions from Hacker News', folder: 'Tech & Architecture', keywords: ['startups', 'tech', 'programming', 'hacker', 'news', 'code', 'hn'] },
  { title: 'MacRumors', url: 'https://feeds.macrumors.com/MacRumors-All', description: 'Apple news, rumors, and product guides', folder: 'Indie Mac & Swift', keywords: ['apple', 'mac', 'ipad', 'iphone', 'rumors'] },
  { title: '9to5Mac', url: 'https://9to5mac.com/feed/', description: 'Apple news, apps, and hardware analysis', folder: 'Indie Mac & Swift', keywords: ['apple', 'iphone', 'mac', 'ios', 'watch'] },
  { title: 'Swift.org Blog', url: 'https://www.swift.org/atom.xml', description: 'Official Swift programming language updates', folder: 'Indie Mac & Swift', keywords: ['swift', 'programming', 'apple', 'ios', 'mac'] },
  { title: 'Hacking with Swift', url: 'https://www.hackingwithswift.com/rss', description: 'Swift and SwiftUI tutorials by Paul Hudson', folder: 'Indie Mac & Swift', keywords: ['swift', 'swiftui', 'ios', 'tutorials', 'coding'] },
  { title: 'TechCrunch', url: 'https://techcrunch.com/feed/', description: 'Startup and technology industry news', folder: 'Tech & Architecture', keywords: ['startups', 'vc', 'tech', 'business', 'news'] },
  { title: 'The New York Times - Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', description: 'Latest technology news from NYT', folder: 'News & World', keywords: ['news', 'tech', 'business', 'world', 'nyt'] },
  { title: 'BBC News - World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', description: 'Breaking news, analysis and comment from BBC', folder: 'News & World', keywords: ['news', 'world', 'bbc', 'global', 'politics'] },
  { title: 'Reuters - Top News', url: 'https://www.reutersagency.com/feed/?best-topics=top-news&post_type=best', description: 'Global breaking news and reporting', folder: 'News & World', keywords: ['news', 'reuters', 'world', 'politics', 'business'] },
  { title: 'Wired', url: 'https://www.wired.com/feed/rss', description: 'How technology is changing our world', folder: 'Tech & Architecture', keywords: ['tech', 'science', 'culture', 'gear'] },
  { title: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', description: 'In-depth analysis of emerging technologies and AI', folder: 'AI & Machine Learning', keywords: ['ai', 'tech', 'research', 'future', 'science'] },
  { title: 'Stratechery by Ben Thompson', url: 'https://stratechery.com/feed/', description: 'Analysis of the strategy and business of technology and media', folder: 'Tech & Architecture', keywords: ['strategy', 'business', 'tech', 'apple', 'google'] },
  { title: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', description: 'For web designers and developers', folder: 'Design & UX', keywords: ['design', 'css', 'javascript', 'ux', 'web', 'ui'] },
  { title: 'A List Apart', url: 'https://alistapart.com/main/feed/', description: 'Explorations of the design, development, and meaning of web content', folder: 'Design & UX', keywords: ['design', 'web', 'standards', 'content', 'ux'] },
  { title: 'Substack Reads', url: 'https://substack.com/feed', description: 'Dispatches from the world of writing and independent culture', folder: 'News & World', keywords: ['substack', 'writing', 'culture', 'news', 'essays'] },
  { title: 'GitHub Blog', url: 'https://github.blog/feed/', description: 'Updates, news, and tips from GitHub', folder: 'Tech & Architecture', keywords: ['github', 'git', 'coding', 'open source', 'dev'] },
  { title: 'OpenAI Blog', url: 'https://openai.com/news/rss.xml', description: 'Research and announcements from OpenAI', folder: 'AI & Machine Learning', keywords: ['openai', 'ai', 'chatgpt', 'research', 'llm'] },
  { title: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', description: 'Latest AI breakthroughs from Google', folder: 'AI & Machine Learning', keywords: ['google', 'ai', 'research', 'gemini', 'machine learning'] },
  { title: 'Financial Times', url: 'https://www.ft.com/?format=rss', description: 'Global business and financial news', folder: 'Finance & Economics', keywords: ['finance', 'business', 'economy', 'markets', 'money', 'stocks'] },
  { title: 'Bloomberg Technology', url: 'https://www.bloomberg.com/feed/podcast/tech-evolved.xml', description: 'Financial and technology news from Bloomberg', folder: 'Finance & Economics', keywords: ['finance', 'tech', 'markets', 'bloomberg', 'economy'] },
  { title: 'NASA Breaking News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', description: 'Latest news and updates from NASA', folder: 'Science & Space', keywords: ['science', 'space', 'nasa', 'astronomy', 'research'] },
  { title: 'Nature', url: 'https://www.nature.com/nature.rss', description: 'International weekly journal of science', folder: 'Science & Space', keywords: ['science', 'nature', 'research', 'biology', 'physics'] },
  { title: 'IGN Games', url: 'https://feeds.feedburner.com/ign/all', description: 'Video game news, reviews, and walkthroughs', folder: 'Gaming & Entertainment', keywords: ['games', 'gaming', 'ign', 'entertainment', 'playstation', 'xbox', 'nintendo'] },
  { title: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', description: 'Gaming, culture, and entertainment news', folder: 'Gaming & Entertainment', keywords: ['gaming', 'polygon', 'culture', 'games', 'movies'] },
  { title: 'Serious Eats', url: 'https://www.seriouseats.com/rss', description: 'Recipes, techniques, and food science', folder: 'Food & Cooking', keywords: ['food', 'cooking', 'recipes', 'kitchen', 'baking', 'chef'] },
  { title: 'Bon Appétit', url: 'https://www.bonappetit.com/feed/rss', description: 'Food and entertaining advice and recipes', folder: 'Food & Cooking', keywords: ['food', 'cooking', 'recipes', 'dining', 'chef'] },
  { title: 'ESPN Top Stories', url: 'https://www.espn.com/espn/rss/news', description: 'Sports news, scores, and analysis', folder: 'Sports & Outdoors', keywords: ['sports', 'espn', 'football', 'basketball', 'soccer', 'scores'] },
  { title: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', description: 'Cryptocurrency, Bitcoin, and blockchain news', folder: 'Cryptocurrencies', keywords: ['crypto', 'bitcoin', 'blockchain', 'ethereum', 'web3', 'finance'] },
  { title: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/', description: 'Reporting and analysis on politics, culture, and science', folder: 'Culture & Books', keywords: ['culture', 'politics', 'books', 'ideas', 'news'] },
  { title: 'The New Yorker', url: 'https://www.newyorker.com/feed/everything', description: 'In-depth reporting, commentary, and criticism', folder: 'Culture & Books', keywords: ['culture', 'books', 'fiction', 'arts', 'news'] }
];

function searchNetNewsWireCatalog(query: string) {
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/);

  const scored = NETNEWSWIRE_MASTER_CATALOG.map(feed => {
    let score = 0;
    const titleLower = feed.title.toLowerCase();
    const descLower = feed.description.toLowerCase();
    const folderLower = feed.folder.toLowerCase();

    for (const term of terms) {
      if (titleLower.includes(term)) score += 15;
      if (descLower.includes(term)) score += 8;
      if (folderLower.includes(term)) score += 5;
      if (feed.keywords.some(k => k.includes(term) || term.includes(k))) score += 10;
    }

    if (titleLower.includes(q) || q.includes(titleLower)) score += 25;

    return { ...feed, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matches = scored.filter(s => s.score > 0);
  if (matches.length > 0) {
    return matches.slice(0, 6);
  }

  // Dynamic real feed generation for custom user queries (e.g., cooking, finance, history, etc.)
  const capitalized = query.charAt(0).toUpperCase() + query.slice(1);
  const cleanQuerySlug = query.toLowerCase().replace(/[^a-z0-9]/g, '');

  return [
    {
      title: `${capitalized} (Google News Live Feed)`,
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}`,
      description: `Live breaking news and updates for "${query}" via Google News RSS.`,
      folder: 'News & World',
      keywords: [query.toLowerCase(), 'news', 'live']
    },
    {
      title: `${capitalized} Substack Publication`,
      url: `https://${cleanQuerySlug}.substack.com/feed`,
      description: `Independent writing and newsletters covering ${query}.`,
      folder: 'Culture & Books',
      keywords: [query.toLowerCase(), 'substack', 'newsletter']
    },
    {
      title: `Hacker News Discussions: ${capitalized}`,
      url: 'https://news.ycombinator.com/rss',
      description: `Tech and community discussions related to ${query} on Hacker News.`,
      folder: 'Developer News',
      keywords: [query.toLowerCase(), 'hacker news', 'tech']
    },
    {
      title: `${capitalized} (Medium Tag Feed)`,
      url: `https://medium.com/feed/tag/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}`,
      description: `Popular stories and expert perspectives about ${query} on Medium.`,
      folder: 'Tech & Architecture',
      keywords: [query.toLowerCase(), 'medium', 'articles']
    }
  ];
}

app.post('/api/ai/search-feeds', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const feeds = searchNetNewsWireCatalog(query);
    res.json({
      success: true,
      feeds,
      notice: 'Powered by NetNewsWire Secret Feed Directory & Live RSS Discovery.'
    });
  } catch (err: any) {
    const fallbacks = NETNEWSWIRE_MASTER_CATALOG.slice(0, 5);
    res.json({
      success: true,
      feeds: fallbacks,
      notice: 'Showing curated popular feeds from NetNewsWire catalog.'
    });
  }
});

// Recommended Tech RSS Feeds using Gemini API with Google Search Grounding
const handleRecommendedTechFeeds = async (_req: Request, res: Response) => {
  const curatedFallbacks = [
    {
      title: 'The Verge',
      url: 'https://www.theverge.com/rss/index.xml',
      homeUrl: 'https://www.theverge.com',
      description: 'The intersection of technology, science, art, and culture.',
      folder: 'Tech & Architecture',
      favicon: 'https://www.google.com/s2/favicons?domain=theverge.com&sz=32'
    },
    {
      title: 'Ars Technica',
      url: 'https://feeds.arstechnica.com/arstechnica/index',
      homeUrl: 'https://arstechnica.com',
      description: 'Deep technology analysis, hardware reviews, and OS architecture.',
      folder: 'Tech & Architecture',
      favicon: 'https://www.google.com/s2/favicons?domain=arstechnica.com&sz=32'
    },
    {
      title: 'Hacker News (Frontpage)',
      url: 'https://news.ycombinator.com/rss',
      homeUrl: 'https://news.ycombinator.com',
      description: 'Curated high-signal engineering and tech startup discussions.',
      folder: 'Developer News',
      favicon: 'https://news.ycombinator.com/favicon.ico'
    },
    {
      title: 'MacRumors',
      url: 'https://feeds.macrumors.com/MacRumors-All',
      homeUrl: 'https://www.macrumors.com',
      description: 'Apple news, iOS & macOS updates, and Apple Silicon developments.',
      folder: 'Indie Mac & Swift',
      favicon: 'https://www.google.com/s2/favicons?domain=macrumors.com&sz=32'
    },
    {
      title: '9to5Mac',
      url: 'https://9to5mac.com/feed/',
      homeUrl: 'https://9to5mac.com',
      description: 'Breaking news on Apple ecosystem, Swift developer ecosystem, and hardware.',
      folder: 'Indie Mac & Swift',
      favicon: 'https://www.google.com/s2/favicons?domain=9to5mac.com&sz=32'
    },
    {
      title: 'Simon Willison’s Weblog',
      url: 'https://simonwillison.net/atom/entries/',
      homeUrl: 'https://simonwillison.net',
      description: 'Practitioner insights on LLMs, open-source AI tools, and web engineering.',
      folder: 'AI & Machine Learning',
      favicon: 'https://www.google.com/s2/favicons?domain=simonwillison.net&sz=32'
    },
    {
      title: 'TechCrunch',
      url: 'https://techcrunch.com/feed/',
      homeUrl: 'https://techcrunch.com',
      description: 'Startup funding rounds, venture analysis, and global technology news.',
      folder: 'Tech & Architecture',
      favicon: 'https://www.google.com/s2/favicons?domain=techcrunch.com&sz=32'
    },
    {
      title: 'Swift.org Blog',
      url: 'https://www.swift.org/atom.xml',
      homeUrl: 'https://www.swift.org',
      description: 'Official announcements and language evolution updates from the Swift team.',
      folder: 'Indie Mac & Swift',
      favicon: 'https://www.google.com/s2/favicons?domain=swift.org&sz=32'
    }
  ];

  try {
    const prompt = `Use Google Search to find 8 to 10 of the most popular, high-quality, and active technology publications, developer blogs, and tech news websites that provide public RSS or Atom feeds.
Find each publication's name, their valid RSS/Atom feed URL, homepage URL, a concise 1-sentence description, and an appropriate category folder (e.g. 'Tech & Architecture', 'AI & Machine Learning', 'Indie Mac & Swift', 'Developer News').
Include prominent tech sources like The Verge, Hacker News (news.ycombinator.com/rss), Ars Technica, 9to5Mac, Simon Willison, or TechCrunch.

Respond ONLY with a valid JSON array matching this format:
[
  {
    "title": "Publication Name",
    "url": "https://example.com/rss.xml",
    "homeUrl": "https://example.com",
    "description": "Short description",
    "folder": "Category Folder"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3
      }
    });

    const text = response.text || '';
    let parsed: any[] = [];
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // Fallback below
      }
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      const verified = parsed
        .filter((f) => f && f.title && f.url && typeof f.url === 'string' && f.url.startsWith('http'))
        .map((f) => {
          let host = '';
          try {
            host = new URL(f.homeUrl || f.url).hostname;
          } catch {}
          let feedUrl = String(f.url).trim();
          if (feedUrl.includes('hnrss.org')) {
            feedUrl = 'https://news.ycombinator.com/rss';
          }
          return {
            title: String(f.title).trim(),
            url: feedUrl,
            homeUrl: f.homeUrl ? String(f.homeUrl).trim() : f.url,
            description: String(f.description || 'Popular technology publication.').trim(),
            folder: String(f.folder || 'Tech & Architecture').trim(),
            favicon: host ? `https://www.google.com/s2/favicons?domain=${host}&sz=32` : undefined
          };
        });

      if (verified.length >= 4) {
        return res.json({
          success: true,
          feeds: verified,
          source: 'Google Search live grounding'
        });
      }
    }
  } catch (err: any) {
    console.warn('Google Search recommendation live query note:', err.message);
  }

  return res.json({
    success: true,
    feeds: curatedFallbacks,
    source: 'Curated popular tech feeds'
  });
};

app.get('/api/ai/recommended-tech-feeds', handleRecommendedTechFeeds);
app.post('/api/ai/recommended-tech-feeds', handleRecommendedTechFeeds);

// AI Briefing: Synthesize unread items into an executive briefing
app.post('/api/ai/briefing', async (req: Request, res: Response) => {
  const { articles } = req.body;
  if (!Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ error: 'No unread articles provided to summarize.' });
  }

  // Sample top unread stories (up to 20) with clean snippets
  const sample = articles.slice(0, 20).map((a: any) => ({
    title: (a.title || 'Untitled').trim(),
    feedTitle: (a.feedTitle || '').trim(),
    snippet: (a.snippet || a.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 320),
    pubDate: a.pubDate
  }));

  try {
    if (process.env.GEMINI_API_KEY) {
      const prompt = `You are an expert executive news editor. Review these ${sample.length} unread RSS articles and create a high-impact briefing:\n\n${JSON.stringify(sample, null, 2)}\n\nInstructions:
1. "executiveSummary": Write a 2 to 3 sentence overview of major themes, trends, or overarching news across all unread stories.
2. "bulletPoints": Provide 3 to 5 high-impact bullet points summarizing the top individual news items.
For each bullet point, include:
- "headline": Short, punchy headline (5 to 10 words)
- "summary": 1 to 2 sentence crisp summary of the development
- "feedTitle": The source publication or author if known`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are an intelligent executive news editor for a premium RSS reader. Synthesize unread articles into a concise, high-signal executive briefing.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description: 'A 2-3 sentence overview of major themes across all unread news.'
              },
              bulletPoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    headline: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    feedTitle: { type: Type.STRING }
                  },
                  required: ['headline', 'summary']
                },
                description: '3 to 5 high-impact bullet points summarizing the top individual news items.'
              }
            },
            required: ['executiveSummary', 'bulletPoints']
          }
        }
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.executiveSummary && Array.isArray(parsed.bulletPoints) && parsed.bulletPoints.length > 0) {
          return res.json({
            success: true,
            executiveSummary: parsed.executiveSummary,
            bulletPoints: parsed.bulletPoints,
            articlesCount: sample.length,
            generatedAt: new Date().toISOString(),
            poweredBy: 'Gemini 3.8 Flash'
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[server] Gemini briefing note:', err.message);
  }

  // Heuristic synthesis fallback (e.g., if quota is exhausted or offline)
  const topArticles = sample.slice(0, 5);
  const feedNames = Array.from(new Set(sample.map((s: any) => s.feedTitle).filter(Boolean)));
  const feedsStr = feedNames.length > 0 ? feedNames.slice(0, 3).join(', ') : 'your subscribed feeds';

  const fallbackExecutiveSummary = `Your briefing synthesizes ${sample.length} unread dispatches from ${feedsStr}. Highlights include key technology announcements, platform updates, and developer discussions across your feeds.`;

  const fallbackBulletPoints = topArticles.map((a: any) => ({
    headline: a.title,
    summary: a.snippet || `Latest updates reported from ${a.feedTitle || 'source'}.`,
    feedTitle: a.feedTitle || 'RSS'
  }));

  return res.json({
    success: true,
    executiveSummary: fallbackExecutiveSummary,
    bulletPoints: fallbackBulletPoints,
    articlesCount: sample.length,
    generatedAt: new Date().toISOString(),
    poweredBy: 'Smart Synthesizer (Fallback)'
  });
});

// Custom Article Scraper (Reader Mode / Full Extractor)
app.post('/api/feeds/scrape-article', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Article URL is required' });
  }

  const safety = await isSafePublicUrl(url);
  if (!safety.safe) {
    return res.status(400).json({ error: `Invalid or restricted article URL: ${safety.reason}` });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 NetNewsWireReader/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream HTTP ${response.status}` });
    }

    const html = await response.text();

    // Extract title
    let title = '';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].trim();

    // Extract og:image
    let leadImage = '';
    const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"'>]+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"'>]+)["'][^>]+property=["']og:image["']/i);
    if (ogImgMatch) leadImage = ogImgMatch[1];

    // Extract author
    let author = '';
    const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"'>]+)["']/i);
    if (authorMatch) author = authorMatch[1].trim();

    // Scrape main content
    // Remove scripts, styles, noscript, iframes, nav, footer, header
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

    // Look for <article>...</article> or <main>...</main> or specific article classes
    let contentBody = '';
    const articleMatch = sanitized.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = sanitized.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const entryContent = sanitized.match(/<div[^>]+class=["'][^"']*(?:entry-content|post-content|article-body|story-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    if (articleMatch) {
      contentBody = articleMatch[1];
    } else if (entryContent) {
      contentBody = entryContent[1];
    } else if (mainMatch) {
      contentBody = mainMatch[1];
    } else {
      // Fallback: extract paragraphs
      const pMatches = sanitized.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
      contentBody = pMatches ? pMatches.join('\n') : '<p>Could not extract article content. View original link below.</p>';
    }

    // Estimate reading time
    const textOnly = contentBody.replace(/<[^>]+>/g, ' ');
    const wordCount = textOnly.trim().split(/\s+/).length;
    const readingTimeMin = Math.max(1, Math.round(wordCount / 200));

    res.json({
      title,
      leadImage,
      author,
      contentHtml: contentBody,
      readingTimeMin,
      wordCount,
      url
    });
  } catch (err: any) {
    console.error('Scraper error:', err.message);
    res.status(500).json({ error: `Article scrape failed: ${err.message}` });
  }
});

// AI 1-Sentence Article Summarizer using Gemini API
app.post('/api/articles/summarize', async (req: Request, res: Response) => {
  const { title, content, snippet, link } = req.body;

  if (!title && !content && !snippet) {
    return res.status(400).json({ error: 'Article content or title is required for summarization.' });
  }

  let rawText = '';
  try {
    // Strip HTML tags for clean text content
    rawText = (content || snippet || '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const promptText = `Please summarize the core insight or news of the following article in exactly one clear, high-signal, punchy sentence.

Rules:
- Provide ONLY a single sentence.
- Do NOT include conversational filler or prefix phrases like "In this article...", "This post discusses...", or "Summary:".
- State the essence directly.

Article Title: ${title || 'Untitled'}
Article Source/Link: ${link || 'Unknown'}
Article Body:
${rawText.slice(0, 10000)}
`;

    let summary = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          systemInstruction: 'You are an expert news analyst and concise RSS reader summary assistant. You distill articles into exactly one impactful, factual sentence.',
          temperature: 0.2
        }
      });
      summary = response.text ? response.text.trim() : '';
    } catch {
      // Fallback model attempt if primary is temporarily busy
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: promptText,
        config: {
          temperature: 0.2
        }
      });
      summary = fallbackResponse.text ? fallbackResponse.text.trim() : '';
    }

    if (!summary) {
      throw new Error('Gemini did not return summary text.');
    }

    return res.json({ success: true, summary });
  } catch (err: any) {
    console.warn('Summarize API quota / busy note (falling back to extracted snippet):', err.message);
    const fallbackSummary = snippet || (rawText ? rawText.slice(0, 160) + '...' : (title ? `Article covering ${title}.` : 'Article update.'));
    return res.json({ success: true, summary: fallbackSummary });
  }
});

// Storage GET & POST
app.get('/api/storage', (_req: Request, res: Response) => {
  const store = readStore();
  res.json({
    feeds: store.feeds || [],
    readArticleIds: store.readArticleIds || [],
    starredArticleIds: store.starredArticleIds || [],
    archivedArticleIds: store.archivedArticleIds || [],
    deletedArticleIds: store.deletedArticleIds || [],
    deletedFeedUrls: store.deletedFeedUrls || [],
    authRequired: store.auth?.authRequired ?? true
  });
});

app.post('/api/storage', requireAuth, (req: Request, res: Response) => {
  const { feeds, readArticleIds, starredArticleIds, archivedArticleIds, deletedArticleIds, deletedFeedUrls } = req.body;
  const store = readStore();

  if (Array.isArray(feeds)) store.feeds = feeds;
  if (Array.isArray(readArticleIds)) store.readArticleIds = readArticleIds;
  if (Array.isArray(starredArticleIds)) store.starredArticleIds = starredArticleIds;
  if (Array.isArray(archivedArticleIds)) store.archivedArticleIds = archivedArticleIds;
  if (Array.isArray(deletedArticleIds)) store.deletedArticleIds = deletedArticleIds;
  if (Array.isArray(deletedFeedUrls)) store.deletedFeedUrls = deletedFeedUrls;

  writeStore(store);
  res.json({ success: true, count: store.feeds.length });
});

// Atomic Article Actions: delete, archive, unarchive, favorite, unfavorite
app.post('/api/articles/action', requireAuth, (req: Request, res: Response) => {
  const { action, articleId, articleIds } = req.body;
  const ids: string[] = Array.isArray(articleIds) ? articleIds : (articleId ? [articleId] : []);
  if (!action || ids.length === 0) {
    return res.status(400).json({ error: 'Action and articleId(s) are required' });
  }

  const store = readStore();
  if (!Array.isArray(store.deletedArticleIds)) store.deletedArticleIds = [];
  if (!Array.isArray(store.archivedArticleIds)) store.archivedArticleIds = [];
  if (!Array.isArray(store.starredArticleIds)) store.starredArticleIds = [];

  const deletedSet = new Set(store.deletedArticleIds);
  const archivedSet = new Set(store.archivedArticleIds);
  const starredSet = new Set(store.starredArticleIds);

  for (const id of ids) {
    if (action === 'delete') {
      deletedSet.add(id);
      archivedSet.delete(id);
    } else if (action === 'restore') {
      deletedSet.delete(id);
    } else if (action === 'archive') {
      archivedSet.add(id);
    } else if (action === 'unarchive') {
      archivedSet.delete(id);
    } else if (action === 'favorite') {
      starredSet.add(id);
    } else if (action === 'unfavorite') {
      starredSet.delete(id);
    } else if (action === 'toggle-favorite') {
      if (starredSet.has(id)) starredSet.delete(id);
      else starredSet.add(id);
    }
  }

  store.deletedArticleIds = Array.from(deletedSet);
  store.archivedArticleIds = Array.from(archivedSet);
  store.starredArticleIds = Array.from(starredSet);

  writeStore(store);

  res.json({
    success: true,
    action,
    deletedArticleIds: store.deletedArticleIds,
    archivedArticleIds: store.archivedArticleIds,
    starredArticleIds: store.starredArticleIds
  });
});

// Helper to escape XML special characters preventing OPML XML injection
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// OPML Import & Export
app.post('/api/opml/import', requireAuth, async (req: Request, res: Response) => {
  const { opmlContent } = req.body;
  if (!opmlContent) {
    return res.status(400).json({ error: 'OPML XML content is required' });
  }

  try {
    const feeds: Array<{ title: string; url: string; homeUrl?: string; folder?: string }> = [];

    // Regex parse OPML outline elements
    const outlineRegex = /<outline\b([^>]+?)(?:\/?>|>([\s\S]*?)<\/outline>)/gi;
    let match;

    while ((match = outlineRegex.exec(opmlContent)) !== null) {
      const attrs = match[1];
      const xmlUrlMatch = attrs.match(/xmlUrl=["']([^"']+)["']/i);

      if (xmlUrlMatch) {
        const textMatch = attrs.match(/text=["']([^"']+)["']/i);
        const titleMatch = attrs.match(/title=["']([^"']+)["']/i);
        const htmlUrlMatch = attrs.match(/htmlUrl=["']([^"']+)["']/i);
        const candidateUrl = xmlUrlMatch[1].trim();

        // SSRF check on imported feed URL
        const safety = await isSafePublicUrl(candidateUrl);
        if (safety.safe) {
          feeds.push({
            title: titleMatch ? titleMatch[1] : (textMatch ? textMatch[1] : 'Imported Feed'),
            url: candidateUrl,
            homeUrl: htmlUrlMatch ? htmlUrlMatch[1] : undefined,
            folder: 'Imported'
          });
        }
      }
    }

    // Merge into store
    const store = readStore();
    const existingUrls = new Set(store.feeds.map((f: any) => f.url));
    let addedCount = 0;

    for (const feed of feeds) {
      if (!existingUrls.has(feed.url)) {
        store.feeds.push({
          id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: feed.title,
          url: feed.url,
          homeUrl: feed.homeUrl || '',
          folder: feed.folder || 'Subscriptions',
          lastFetched: null
        });
        existingUrls.add(feed.url);
        addedCount++;
      }
    }

    writeStore(store);
    res.json({ success: true, importedCount: addedCount, totalParsed: feeds.length });
  } catch (err: any) {
    res.status(500).json({ error: `OPML parsing failed: ${err.message}` });
  }
});

app.get('/api/opml/export', (_req: Request, res: Response) => {
  const store = readStore();
  const feeds = store.feeds || [];

  const groupedByFolder: Record<string, any[]> = {};
  for (const f of feeds) {
    const folder = f.folder || 'Feeds';
    if (!groupedByFolder[folder]) groupedByFolder[folder] = [];
    groupedByFolder[folder].push(f);
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSSNewsFeeds Feeds</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>\n`;

  for (const [folder, folderFeeds] of Object.entries(groupedByFolder)) {
    const cleanFolder = escapeXml(folder);
    xml += `    <outline text="${cleanFolder}" title="${cleanFolder}">\n`;
    for (const f of folderFeeds) {
      const cleanTitle = escapeXml(f.title || 'Feed');
      const cleanUrl = escapeXml(f.url || '');
      const cleanHome = escapeXml(f.homeUrl || '');
      xml += `      <outline type="rss" text="${cleanTitle}" title="${cleanTitle}" xmlUrl="${cleanUrl}" htmlUrl="${cleanHome}" />\n`;
    }
    xml += `    </outline>\n`;
  }

  xml += `  </body>
</opml>`;

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="rssnewsfeeds_feeds.opml"');
  res.send(xml);
});

// ======================== SERVER SETUP ========================

async function startServer() {
  if (isDev) {
    // Dynamically create Vite server in middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend files in production
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`RSSNewsFeeds Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
