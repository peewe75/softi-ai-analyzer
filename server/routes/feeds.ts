import crypto from 'crypto';
import { Router } from 'express';
import Parser from 'rss-parser';

type FeedSource = {
  id: string;
  label: string;
  url: string;
};

type FeedItemPayload = {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  source: string;
};

const FEED_CACHE_TTL_MS = 90_000;
const FEED_FETCH_TIMEOUT_MS = 10_000;
const MAX_ITEMS_PER_SOURCE = 12;
const MAX_ITEMS_TOTAL = 15;

const FEED_SOURCES: FeedSource[] = [
  {
    id: 'forexlive',
    label: 'ForexLive',
    url: 'https://www.forexlive.com/feed',
  },
  {
    id: 'yahoo-finance',
    label: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
  },
];

const parser = new Parser();

let cachedItems: FeedItemPayload[] = [];
let cachedAt = 0;

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeItem(source: FeedSource, rawItem: Record<string, unknown>): FeedItemPayload | null {
  const title = String(rawItem.title || '').trim();
  const link = String(rawItem.link || '').trim();
  if (!title || !link) return null;

  const pubDate = String(rawItem.isoDate || rawItem.pubDate || new Date().toISOString());
  const rawSnippet = String(
    rawItem.contentSnippet ||
    rawItem.content ||
    rawItem.summary ||
    rawItem.title ||
    '',
  );

  return {
    id: String(
      rawItem.guid ||
      crypto.createHash('md5').update(`${source.id}:${link}:${pubDate}`).digest('hex'),
    ),
    title,
    link,
    pubDate,
    contentSnippet: stripHtml(rawSnippet).slice(0, 240),
    source: source.label,
  };
}

async function fetchFeed(source: FeedSource): Promise<FeedItemPayload[]> {
  const response = await fetch(source.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FEED_FETCH_TIMEOUT_MS),
    headers: {
      'user-agent': 'Softi AI Analyzer RSS/1.0',
      accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Feed ${source.label} responded with ${response.status}`);
  }

  const xml = await response.text();
  const parsed = await parser.parseString(xml);

  return (parsed.items || [])
    .map((item) => normalizeItem(source, item as unknown as Record<string, unknown>))
    .filter((item): item is FeedItemPayload => Boolean(item))
    .slice(0, MAX_ITEMS_PER_SOURCE);
}

export function createFeedsRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const now = Date.now();
    if (cachedItems.length > 0 && now - cachedAt < FEED_CACHE_TTL_MS) {
      return res.json({
        items: cachedItems,
        updatedAt: new Date(cachedAt).toISOString(),
        cached: true,
      });
    }

    const results = await Promise.allSettled(FEED_SOURCES.map((source) => fetchFeed(source)));

    const freshItems = results
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, MAX_ITEMS_TOTAL);

    if (freshItems.length > 0) {
      cachedItems = freshItems;
      cachedAt = now;

      return res.json({
        items: freshItems,
        updatedAt: new Date(now).toISOString(),
        cached: false,
      });
    }

    if (cachedItems.length > 0) {
      return res.json({
        items: cachedItems,
        updatedAt: new Date(cachedAt).toISOString(),
        cached: true,
        stale: true,
      });
    }

    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

    return res.status(502).json({
      error: 'Unable to load RSS feeds',
      details: errors,
    });
  });

  return router;
}
