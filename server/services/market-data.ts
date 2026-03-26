type MarketTrend = 'up' | 'down' | 'neutral';

type ResolvedMarketRow = {
  symbol: string;
  price: string;
  change: string;
  trend: MarketTrend;
};

type MarketauxArticle = {
  title?: string;
  description?: string;
  entities?: Array<{
    symbol?: string;
    sentiment_score?: number;
  }>;
};

type ResolveMarketDataArgs = {
  ai: any;
  symbols: string[] | string;
  activeFeeds?: string[] | null;
};

type ResolveMarketDataResult = {
  rows: ResolvedMarketRow[];
  warnings: string[];
  providersUsed: string[];
};

const DEFAULT_FEEDS = ['google'];
const SUPPORTED_FEEDS = new Set(['google', 'yahoo', 'marketaux', 'news-events']);
const GOOGLE_BATCH_SIZE = 14;
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
const MARKETAUX_URL = 'https://api.marketaux.com/v1/news/all';

const EXACT_YAHOO_SYMBOLS: Record<string, string> = {
  'XAUUSD': 'GC=F',
  'XAGUSD': 'SI=F',
  'HG1!': 'HG=F',
  'CL1!': 'CL=F',
  'CB1!': 'BZ=F',
  'NG1!': 'NG=F',
  'ZW1!': 'ZW=F',
  'ZC1!': 'ZC=F',
  'ZS1!': 'ZS=F',
  'ES1!': 'ES=F',
  'NQ1!': 'NQ=F',
  'YM1!': 'YM=F',
  'DAX': '^GDAXI',
  'FTSEMIB': 'FTSEMIB.MI',
  'UK100': '^FTSE',
  'FCE1!': '^FCHI',
  'NIY1!': '^N225',
  'US10Y': '^TNX',
};

const CRYPTO_BASES = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'BNB', 'LINK']);

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function normalizeActiveFeeds(input: unknown): string[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : DEFAULT_FEEDS;

  const normalized = Array.from(new Set(values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => SUPPORTED_FEEDS.has(value))));

  return normalized.length > 0 ? normalized : DEFAULT_FEEDS;
}

function normalizeSymbols(input: string[] | string): string[] {
  const raw = Array.isArray(input) ? input : String(input || '').split(',');
  return Array.from(new Set(raw
    .map((value) => String(value || '').trim().toUpperCase())
    .filter((value) => value.length > 0)));
}

function mapToYahooSymbol(symbol: string): string | null {
  if (EXACT_YAHOO_SYMBOLS[symbol]) return EXACT_YAHOO_SYMBOLS[symbol];
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol}=X`;
  if (/^[A-Z]{3,5}USD$/.test(symbol)) {
    const base = symbol.slice(0, -3);
    if (CRYPTO_BASES.has(base)) return `${base}-USD`;
  }
  if (/^[A-Z0-9.-]+$/.test(symbol)) return symbol;
  return null;
}

function asTrendFromNumber(value: number | undefined | null): MarketTrend {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}

function formatPrice(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '...';
  const absolute = Math.abs(value);
  const fractionDigits = absolute >= 1000 ? 2 : absolute >= 1 ? 4 : 6;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatPercent(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '...';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

function extractJsonArray(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }

  const match = trimmed.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, ResolvedMarketRow>> {
  const yahooPairs = symbols
    .map((symbol) => ({ original: symbol, yahoo: mapToYahooSymbol(symbol) }))
    .filter((entry): entry is { original: string; yahoo: string } => Boolean(entry.yahoo));

  if (yahooPairs.length === 0) return new Map();

  const query = new URL(YAHOO_QUOTE_URL);
  query.searchParams.set('symbols', yahooPairs.map((entry) => entry.yahoo).join(','));

  const response = await fetch(query, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      'user-agent': 'Softi AI Analyzer/1.0',
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance responded with ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.quoteResponse?.result) ? payload.quoteResponse.result : [];
  const byYahooSymbol = new Map<string, any>();

  for (const quote of results) {
    const key = String(quote?.symbol || '').toUpperCase();
    if (!key) continue;
    byYahooSymbol.set(key, quote);
  }

  const resolved = new Map<string, ResolvedMarketRow>();
  for (const entry of yahooPairs) {
    const quote = byYahooSymbol.get(entry.yahoo.toUpperCase());
    if (!quote) continue;

    resolved.set(entry.original, {
      symbol: entry.original,
      price: formatPrice(Number(quote.regularMarketPrice)),
      change: formatPercent(Number(quote.regularMarketChangePercent)),
      trend: asTrendFromNumber(Number(quote.regularMarketChangePercent)),
    });
  }

  return resolved;
}

async function fetchMarketauxContext(): Promise<{
  headlines: string[];
  averageSentiment: number | null;
}> {
  const apiToken = process.env.MARKETAUX_API_KEY;
  if (!apiToken) {
    throw new Error('MARKETAUX_API_KEY is not configured');
  }

  const query = new URL(MARKETAUX_URL);
  query.searchParams.set('api_token', apiToken);
  query.searchParams.set('language', 'en');
  query.searchParams.set('limit', '6');
  query.searchParams.set('sort', 'published_desc');

  const response = await fetch(query, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      'user-agent': 'Softi AI Analyzer/1.0',
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Marketaux responded with ${response.status}`);
  }

  const payload = await response.json();
  const articles = Array.isArray(payload?.data) ? (payload.data as MarketauxArticle[]) : [];
  const headlines = articles
    .map((article) => [article.title, article.description].filter(Boolean).join(' - ').trim())
    .filter((value) => value.length > 0)
    .slice(0, 4);

  const sentiments = articles
    .flatMap((article) => Array.isArray(article.entities) ? article.entities : [])
    .map((entity) => Number(entity.sentiment_score))
    .filter((value) => Number.isFinite(value));

  const averageSentiment = sentiments.length > 0
    ? sentiments.reduce((sum, value) => sum + value, 0) / sentiments.length
    : null;

  return { headlines, averageSentiment };
}

async function fetchGoogleGroundedQuotes(
  ai: any,
  symbols: string[],
  context: {
    marketauxHeadlines?: string[];
    marketauxAverageSentiment?: number | null;
  },
): Promise<ResolvedMarketRow[]> {
  if (symbols.length === 0) return [];

  const batches = chunk(symbols, GOOGLE_BATCH_SIZE);
  const rows: ResolvedMarketRow[] = [];

  for (const batch of batches) {
    const contextLines: string[] = [];

    if (context.marketauxHeadlines && context.marketauxHeadlines.length > 0) {
      contextLines.push(`Marketaux macro headlines: ${context.marketauxHeadlines.join(' | ')}`);
    }

    if (typeof context.marketauxAverageSentiment === 'number') {
      contextLines.push(`Marketaux average sentiment score: ${context.marketauxAverageSentiment.toFixed(3)}`);
    }

    const prompt = [
      'Return only valid JSON.',
      'Build a JSON array with one object per requested symbol.',
      'Each object must have exactly these fields: symbol, price, change, trend.',
      'price must be a compact display string, not a sentence.',
      'change must be a signed percentage string like +0.52% or -1.13%.',
      'trend must be one of: up, down, neutral.',
      'Do not wrap the JSON in markdown fences.',
      contextLines.length > 0 ? contextLines.join('\n') : '',
      `Requested symbols: ${batch.join(', ')}`,
    ].filter(Boolean).join('\n\n');

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const parsed = extractJsonArray(response.text || '');
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const symbol = String((entry as Record<string, unknown>).symbol || '').trim().toUpperCase();
      if (!symbol) continue;

      const rawTrend = String((entry as Record<string, unknown>).trend || 'neutral').toLowerCase();
      const trend: MarketTrend =
        rawTrend === 'up' || rawTrend === 'down' || rawTrend === 'neutral'
          ? rawTrend
          : 'neutral';

      rows.push({
        symbol,
        price: String((entry as Record<string, unknown>).price || '...').trim() || '...',
        change: String((entry as Record<string, unknown>).change || '...').trim() || '...',
        trend,
      });
    }
  }

  return rows;
}

function applySentimentFallback(rows: ResolvedMarketRow[], averageSentiment: number | null) {
  if (typeof averageSentiment !== 'number') return rows;

  const sentimentTrend: MarketTrend =
    averageSentiment > 0.08 ? 'up' : averageSentiment < -0.08 ? 'down' : 'neutral';

  return rows.map((row) => {
    if (row.trend !== 'neutral' || row.change !== '...') return row;
    return { ...row, trend: sentimentTrend };
  });
}

export async function resolveMarketData({
  ai,
  symbols,
  activeFeeds,
}: ResolveMarketDataArgs): Promise<ResolveMarketDataResult> {
  const requestedSymbols = normalizeSymbols(symbols);
  const feeds = normalizeActiveFeeds(activeFeeds);
  const warnings: string[] = [];
  const providersUsed: string[] = [];
  const resolvedBySymbol = new Map<string, ResolvedMarketRow>();

  let marketauxContext: { headlines: string[]; averageSentiment: number | null } | null = null;

  if (feeds.includes('yahoo')) {
    try {
      const yahooRows = await fetchYahooQuotes(requestedSymbols);
      if (yahooRows.size > 0) {
        providersUsed.push('yahoo');
        for (const [symbol, row] of yahooRows.entries()) {
          resolvedBySymbol.set(symbol, row);
        }
      }
    } catch (error: any) {
      warnings.push(`Yahoo provider unavailable: ${error?.message || 'unknown error'}`);
    }
  }

  if (feeds.includes('marketaux')) {
    try {
      marketauxContext = await fetchMarketauxContext();
      providersUsed.push('marketaux');
    } catch (error: any) {
      warnings.push(`Marketaux provider unavailable: ${error?.message || 'unknown error'}`);
    }
  }

  if (feeds.includes('google')) {
    const unresolvedSymbols = requestedSymbols.filter((symbol) => !resolvedBySymbol.has(symbol));
    if (unresolvedSymbols.length > 0) {
      try {
        const googleRows = await fetchGoogleGroundedQuotes(ai, unresolvedSymbols, {
          marketauxHeadlines: marketauxContext?.headlines,
          marketauxAverageSentiment: marketauxContext?.averageSentiment,
        });

        if (googleRows.length > 0) {
          providersUsed.push('google');
          for (const row of googleRows) {
            if (!resolvedBySymbol.has(row.symbol)) {
              resolvedBySymbol.set(row.symbol, row);
            }
          }
        }
      } catch (error: any) {
        warnings.push(`Google provider unavailable: ${error?.message || 'unknown error'}`);
      }
    }
  }

  let rows = requestedSymbols.map((symbol) => (
    resolvedBySymbol.get(symbol) || {
      symbol,
      price: '...',
      change: '...',
      trend: 'neutral' as MarketTrend,
    }
  ));

  rows = applySentimentFallback(rows, marketauxContext?.averageSentiment ?? null);

  return {
    rows,
    warnings,
    providersUsed: Array.from(new Set(providersUsed)),
  };
}
