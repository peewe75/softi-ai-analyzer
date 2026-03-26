import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    Database,
    ExternalLink,
    Lock,
    Radio,
    RefreshCw,
    X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { DataFeed, RssFeedItem } from '../../types';

interface FeedsTabProps {
    dataFeeds: DataFeed[];
    activeFeeds: string[];
    setActiveFeeds: React.Dispatch<React.SetStateAction<string[]>>;
}

type FeedResponse = {
    items?: RssFeedItem[];
    updatedAt?: string;
};

const NEWS_FEED_ID = 'news-events';
const CURRENCY_REGEX = /\b(USD|EUR|GBP|JPY|CHF|AUD|NZD|CAD|XAU|XAG|BTC|ETH|OIL|GOLD|SILVER)\b/gi;

function extractCurrencyTags(text: string): string[] {
    const matches = text.match(CURRENCY_REGEX) || [];
    return Array.from(new Set(matches.map((value) => value.toUpperCase()))).slice(0, 4);
}

function formatFeedDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Data non disponibile';
    return parsed.toLocaleString('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default function FeedsTab({
    dataFeeds,
    activeFeeds,
    setActiveFeeds
}: FeedsTabProps) {
    const [newsItems, setNewsItems] = useState<RssFeedItem[]>([]);
    const [isLoadingNews, setIsLoadingNews] = useState(false);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const newsFeedEnabled = activeFeeds.includes(NEWS_FEED_ID);

    const loadNewsFeed = async () => {
        setIsLoadingNews(true);
        setFeedError(null);

        try {
            const response = await fetch('/api/feeds');
            const payload: FeedResponse = await response.json();

            if (!response.ok) {
                throw new Error((payload as { error?: string }).error || 'Feed fetch failed');
            }

            setNewsItems(Array.isArray(payload.items) ? payload.items : []);
            setLastUpdated(payload.updatedAt || new Date().toISOString());
        } catch (error) {
            console.error('Unable to load RSS feed:', error);
            setFeedError('Impossibile sincronizzare le news in questo momento.');
        } finally {
            setIsLoadingNews(false);
        }
    };

    useEffect(() => {
        if (!newsFeedEnabled) return;

        loadNewsFeed();
        const interval = window.setInterval(loadNewsFeed, 180000);

        return () => window.clearInterval(interval);
    }, [newsFeedEnabled]);

    const sentimentTags = useMemo(() => {
        return Array.from(
            new Set(
                newsItems.flatMap((item) => extractCurrencyTags(`${item.title} ${item.contentSnippet}`))
            )
        ).slice(0, 8);
    }, [newsItems]);

    return (
        <motion.div
            key="feeds"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="relative overflow-hidden rounded-[28px] border border-[#30363D] bg-[#161B22] p-6 shadow-xl">
                <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,_rgba(0,163,255,0.14),_transparent_70%)]" />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3">
                            <Database size={24} className="text-[#00A3FF]" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black uppercase tracking-tight text-white">Enterprise Data Feeds</h2>
                            <p className="max-w-2xl text-sm text-[#8B949E]">
                                Connetti provider esterni e apri il live wire macro. Il feed RSS aggrega headline di mercato ordinate in tempo reale dal backend.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] px-4 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6E7681]">Feeds attivi</p>
                            <p className="text-lg font-black text-white">{activeFeeds.length}</p>
                        </div>
                        <div className="rounded-2xl border border-[#00A3FF]/20 bg-[#00A3FF]/8 px-4 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7DCBFF]">News wire</p>
                            <p className="text-lg font-black text-[#F0F6FC]">{newsFeedEnabled ? 'ONLINE' : 'OFFLINE'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {dataFeeds.map((feed) => {
                            const isSelected = activeFeeds.includes(feed.id);
                            const isNewsFeed = feed.id === NEWS_FEED_ID;

                            return (
                                <motion.div
                                    key={feed.id}
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.28 }}
                                    className={cn(
                                        'group flex min-h-[220px] flex-col justify-between rounded-[24px] border p-6 shadow-lg transition-all',
                                        isSelected
                                            ? 'border-[#00A3FF]/35 bg-[linear-gradient(180deg,rgba(0,163,255,0.08),rgba(13,17,23,0.65))]'
                                            : 'border-[#30363D] bg-[#161B22] hover:border-[#5B6574]'
                                    )}
                                >
                                    <div className="space-y-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#6E7681]">
                                                    Provider {feed.provider}
                                                </p>
                                                <h3 className="text-lg font-black text-white transition-colors group-hover:text-[#7DCBFF]">
                                                    {feed.name}
                                                </h3>
                                            </div>
                                            <span className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
                                                feed.status === 'active'
                                                    ? 'border border-[#238636]/25 bg-[#238636]/12 text-[#3FB950]'
                                                    : 'border border-[#DA3633]/20 bg-[#DA3633]/10 text-[#F85149]'
                                            )}>
                                                {feed.status === 'active' ? <CheckCircle2 size={11} /> : <X size={11} />}
                                                {feed.status}
                                            </span>
                                        </div>

                                        <p className="text-sm leading-6 text-[#8B949E]">{feed.description}</p>

                                        <div className="flex flex-wrap gap-2">
                                            <span className={cn(
                                                'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
                                                feed.type === 'free'
                                                    ? 'bg-[#238636]/12 text-[#3FB950]'
                                                    : 'bg-[#E3B341]/12 text-[#F2CC60]'
                                            )}>
                                                {feed.type}
                                            </span>
                                            {isNewsFeed && (
                                                <span className="rounded-full bg-[#00A3FF]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7DCBFF]">
                                                    Live sentiment
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (feed.status !== 'active') return;
                                            setActiveFeeds((previous) =>
                                                previous.includes(feed.id)
                                                    ? previous.filter((entry) => entry !== feed.id)
                                                    : [...previous, feed.id]
                                            );
                                        }}
                                        disabled={feed.status === 'inactive'}
                                        className={cn(
                                            'mt-6 w-full rounded-2xl py-3 text-xs font-black uppercase tracking-[0.24em] transition-all',
                                            feed.status === 'inactive'
                                                ? 'cursor-not-allowed border border-[#484F58]/30 bg-[#30363D] text-[#8B949E]'
                                                : isSelected
                                                    ? 'bg-[#00A3FF] text-white shadow-lg shadow-[#00A3FF]/20'
                                                    : 'border border-[#30363D] bg-[#0D1117] text-[#C9D1D9] hover:border-[#00A3FF] hover:text-white'
                                        )}
                                    >
                                        {feed.status === 'inactive' ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Lock size={12} />
                                                Access Restricted
                                            </span>
                                        ) : isSelected ? (
                                            isNewsFeed ? 'Connected' : 'Enabled'
                                        ) : isNewsFeed ? 'Connect' : 'Authorize Feed'}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                <motion.aside
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[28px] border border-[#30363D] bg-[#0F141B] p-5 shadow-2xl"
                >
                    <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(0,163,255,0.12),transparent)]" />
                    <div className="relative space-y-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#6E7681]">News & Events</p>
                                <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-white">
                                    <Radio size={16} className="text-[#00A3FF]" />
                                    Live Wire
                                </h3>
                            </div>

                            <button
                                onClick={() => loadNewsFeed()}
                                disabled={!newsFeedEnabled || isLoadingNews}
                                className="inline-flex items-center gap-2 rounded-xl border border-[#30363D] bg-[#11161E] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#C9D1D9] transition-colors hover:border-[#00A3FF] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RefreshCw size={13} className={cn(isLoadingNews && 'animate-spin')} />
                                Refresh
                            </button>
                        </div>

                        <div className="rounded-2xl border border-[#30363D] bg-[#11161E] p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6E7681]">Sync status</p>
                                    <p className={cn(
                                        'mt-1 text-sm font-black uppercase tracking-wider',
                                        newsFeedEnabled ? 'text-[#3FB950]' : 'text-[#8B949E]'
                                    )}>
                                        {newsFeedEnabled ? 'Connected' : 'Not connected'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6E7681]">Last update</p>
                                    <p className="mt-1 text-xs text-[#C9D1D9]">
                                        {lastUpdated ? formatFeedDate(lastUpdated) : '--'}
                                    </p>
                                </div>
                            </div>

                            {sentimentTags.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {sentimentTags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-full border border-[#E3B341]/25 bg-[#E3B341]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#F2CC60]"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!newsFeedEnabled ? (
                            <div className="rounded-2xl border border-dashed border-[#30363D] bg-[#11161E] px-5 py-10 text-center">
                                <p className="text-sm font-semibold text-white">Connetti il provider News & Events</p>
                                <p className="mt-2 text-sm leading-6 text-[#8B949E]">
                                    Una volta abilitato, questa colonna mostrerà le ultime headline aggregate da ForexLive e Yahoo Finance.
                                </p>
                            </div>
                        ) : feedError ? (
                            <div className="rounded-2xl border border-[#DA3633]/20 bg-[#DA3633]/10 px-4 py-4 text-sm text-[#FFB3AD]">
                                <div className="flex items-start gap-3">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <span>{feedError}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {isLoadingNews && newsItems.length === 0 ? (
                                    <div className="space-y-3">
                                        {Array.from({ length: 4 }).map((_, index) => (
                                            <div key={index} className="rounded-2xl border border-[#30363D] bg-[#11161E] p-4">
                                                <div className="h-3 w-20 animate-pulse rounded bg-[#30363D]" />
                                                <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#30363D]" />
                                                <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-[#30363D]" />
                                            </div>
                                        ))}
                                    </div>
                                ) : newsItems.length === 0 ? (
                                    <div className="rounded-2xl border border-[#30363D] bg-[#11161E] px-5 py-10 text-center text-sm text-[#8B949E]">
                                        Nessuna headline disponibile.
                                    </div>
                                ) : (
                                    newsItems.map((item, index) => {
                                        const tags = extractCurrencyTags(`${item.title} ${item.contentSnippet}`);

                                        return (
                                            <motion.a
                                                key={item.id}
                                                href={item.link}
                                                target="_blank"
                                                rel="noreferrer"
                                                initial={{ opacity: 0, y: 14 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                                className="block rounded-[22px] border border-[#30363D] bg-[#11161E] p-4 transition-all hover:-translate-y-0.5 hover:border-[#00A3FF]/35 hover:bg-[#151C25]"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6E7681]">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Clock3 size={11} />
                                                                {formatFeedDate(item.pubDate)}
                                                            </span>
                                                            {item.source && <span>{item.source}</span>}
                                                        </div>
                                                        <h4 className="text-sm font-black leading-6 text-white">{item.title}</h4>
                                                    </div>
                                                    <ExternalLink size={14} className="mt-1 shrink-0 text-[#6E7681]" />
                                                </div>

                                                <p className="mt-3 text-sm leading-6 text-[#8B949E]">
                                                    {item.contentSnippet}
                                                </p>

                                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                                    {tags.length > 0 ? tags.map((tag) => (
                                                        <span
                                                            key={`${item.id}-${tag}`}
                                                            className="rounded-full border border-[#00A3FF]/20 bg-[#00A3FF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7DCBFF]"
                                                        >
                                                            {tag}
                                                        </span>
                                                    )) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-[#30363D] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#8B949E]">
                                                            <Radio size={10} />
                                                            Macro
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.a>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </motion.aside>
            </div>
        </motion.div>
    );
}
