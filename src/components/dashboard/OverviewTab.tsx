import React from 'react';
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    ChevronRight,
    Filter,
    Globe2,
    Minus,
    MousePointerClick,
    Newspaper,
    Search,
    Star,
    TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';
import type { Asset } from '../../types';
import type { Mt5MarketOverviewRow } from '../../mt5/types';

interface OverviewTabProps {
    assets: Asset[];
    marketRows: Mt5MarketOverviewRow[];
    selectedAssets: string[];
    toggleAssetSelection: (id: string) => void;
    onOpenInteractiveAnalysis: (symbol: string) => void;
    isLoading: boolean;
    lastUpdate: Date;
    expandedAssetCategories: string[];
    toggleAssetCategory: (cat: string) => void;
}

function confidencePercent(score?: number): number {
    if (typeof score !== 'number' || Number.isNaN(score)) return 0;
    return Math.max(0, Math.min(100, Math.round(score * 100)));
}

function confidenceColor(percent: number): string {
    if (percent >= 80) return '#F2CC60';
    if (percent >= 60) return '#3FB950';
    if (percent >= 40) return '#7DCBFF';
    return '#F85149';
}

function ConfidenceGauge({ score }: { score?: number }) {
    if (typeof score !== 'number') {
        return <span className="text-xs font-bold uppercase tracking-widest text-[#6E7681]">No data</span>;
    }

    const percent = confidencePercent(score);
    const fill = confidenceColor(percent);

    return (
        <div className="relative h-16 w-24">
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    data={[{ value: percent, fill }]}
                    cx="50%"
                    cy="95%"
                    innerRadius="55%"
                    outerRadius="95%"
                    startAngle={180}
                    endAngle={0}
                    barSize={10}
                >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" background={{ fill: '#21262D' }} cornerRadius={10} />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-x-0 bottom-2 flex flex-col items-center justify-center">
                <span className="text-sm font-black" style={{ color: fill }}>{percent}%</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#6E7681]">Confidence</span>
            </div>
        </div>
    );
}

export default function OverviewTab({
    assets,
    marketRows,
    selectedAssets,
    toggleAssetSelection,
    onOpenInteractiveAnalysis,
    isLoading,
    lastUpdate,
    expandedAssetCategories,
    toggleAssetCategory
}: OverviewTabProps) {
    const categories = Array.from(new Set(assets.map((asset) => asset.category)));
    const averageConfidence = marketRows.length > 0
        ? Math.round(
            marketRows.reduce((sum, row) => sum + (row.confidence_score || 0), 0) / marketRows.length * 100
        )
        : 0;
    const liquiditySweeps = marketRows.filter((row) => row.liquidity_sweep).length;
    const strongestSetup = marketRows[0];
    const lastMt5Update = strongestSetup?.updated_at
        ? new Date(strongestSetup.updated_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        : lastUpdate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return (
        <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[
                    {
                        label: 'MT5 stream',
                        value: marketRows.length > 0 ? `${marketRows.length} symbols` : 'Waiting',
                        hint: strongestSetup?.symbol ? `Top setup ${strongestSetup.symbol}` : 'No packets yet',
                        color: 'text-[#00A3FF]',
                        icon: Globe2
                    },
                    {
                        label: 'Avg confidence',
                        value: `${averageConfidence}%`,
                        hint: 'Derived from live market overview',
                        color: 'text-[#F2CC60]',
                        icon: TrendingUp
                    },
                    {
                        label: 'Liquidity sweeps',
                        value: String(liquiditySweeps),
                        hint: 'Active sweep signals in stream',
                        color: 'text-[#3FB950]',
                        icon: Activity
                    },
                    {
                        label: 'Last MT5 update',
                        value: lastMt5Update,
                        hint: 'Latest bridge timestamp',
                        color: 'text-[#7DCBFF]',
                        icon: Newspaper
                    }
                ].map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="rounded-[22px] border border-[#30363D] bg-[#161B22] p-4 shadow-xl"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-2.5">
                                <stat.icon size={18} className={stat.color} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8B949E]">{stat.label}</p>
                                <p className={cn('mt-1 text-lg font-black', stat.color)}>{stat.value}</p>
                                <p className="mt-1 text-[11px] text-[#6E7681]">{stat.hint}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#30363D] bg-[#161B22] shadow-2xl">
                <div className="flex flex-col gap-4 border-b border-[#30363D] bg-[#1C2128] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-[#8B949E]">Market Overview (MT5 Stream)</h3>
                        <p className="mt-1 text-[11px] text-[#6E7681]">
                            Clicca un asset per aprire Interactive Analysis con l&apos;ultimo analyzer JSON disponibile.
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#00A3FF]/30 bg-[#00A3FF]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#7DCBFF]">
                        <MousePointerClick size={12} /> Click to inspect
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#30363D] text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7681]">
                                <th className="px-6 py-4">Asset</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Market Regime</th>
                                <th className="px-6 py-4">Bias (H4 / D1 / W1)</th>
                                <th className="px-6 py-4">Wyckoff</th>
                                <th className="px-6 py-4">Liquidity</th>
                                <th className="px-6 py-4">Confidence Arc</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#30363D]/50">
                            {marketRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-[#6E7681]">
                                        Nessun pacchetto MT5 ancora ricevuto. Il bridge popolera questa griglia in tempo reale.
                                    </td>
                                </tr>
                            ) : marketRows.map((row) => (
                                <tr
                                    key={row.symbol}
                                    onClick={() => onOpenInteractiveAnalysis(row.symbol)}
                                    className="cursor-pointer transition-colors hover:bg-[#1C2128]"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-white">{row.symbol}</span>
                                            <span className="text-[10px] uppercase tracking-[0.2em] text-[#6E7681]">
                                                Updated {new Date(row.updated_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm text-[#C9D1D9]">
                                        {row.price ?? 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        <span className="rounded-md border border-[#30363D] bg-[#0D1117] px-2 py-1 font-semibold uppercase text-[#8B949E]">
                                            {row.market_regime || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-[#8B949E]">
                                        {`${row.bias_h4 || 'N/A'} / ${row.bias_d1 || 'N/A'} / ${row.bias_w1 || 'N/A'}`}
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        {row.wyckoff_phase ? (
                                            <span className="rounded border border-[#8B949E]/30 bg-[#8B949E]/10 px-2 py-1 text-[#C9D1D9]">
                                                {row.wyckoff_phase} {row.wyckoff_event && `- ${row.wyckoff_event}`}
                                            </span>
                                        ) : <span className="text-[#484F58]">-</span>}
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        <div className="flex items-center gap-2">
                                            {row.liquidity_above && <span className="h-2 w-2 rounded-full bg-[#00A3FF]" title="Liquidity Above" />}
                                            {row.liquidity_below && <span className="h-2 w-2 rounded-full bg-[#F85149]" title="Liquidity Below" />}
                                            {row.liquidity_sweep && <span className="h-2 w-2 rounded-full bg-[#E3B341]" title="Liquidity Sweep" />}
                                            {!row.liquidity_above && !row.liquidity_below && !row.liquidity_sweep && (
                                                <span className="text-[#484F58]">-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <ConfidenceGauge score={row.confidence_score} />
                                            <div className="min-w-[88px]">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7681]">Signal quality</p>
                                                <p
                                                    className="mt-1 text-sm font-black"
                                                    style={{ color: confidenceColor(confidencePercent(row.confidence_score)) }}
                                                >
                                                    {typeof row.confidence_score === 'number'
                                                        ? confidencePercent(row.confidence_score) >= 80 ? 'High conviction' : confidencePercent(row.confidence_score) >= 60 ? 'Constructive' : 'Developing'
                                                        : 'No signal'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#30363D] bg-[#161B22] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#30363D] bg-[#1C2128] px-6 py-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-[#8B949E]">Global Asset Matrix</h3>
                        <div className="flex gap-2">
                            <span className="rounded-full border border-[#238636]/20 bg-[#238636]/10 px-2 py-0.5 text-[10px] font-bold text-[#3FB950]">LIVE</span>
                            <span className="rounded-full border border-[#00A3FF]/20 bg-[#00A3FF]/10 px-2 py-0.5 text-[10px] font-bold text-[#7DCBFF]">AI GROUNDED</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-[#8B949E] transition-colors hover:text-white" title="Search assets">
                            <Search size={16} />
                        </button>
                        <button className="p-2 text-[#8B949E] transition-colors hover:text-white" title="Filter assets">
                            <Filter size={16} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#30363D] text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7681]">
                                <th className="w-10 px-6 py-4 text-center">#</th>
                                <th className="px-6 py-4">Symbol</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">24h Change</th>
                                <th className="px-6 py-4">Sector</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#30363D]/50">
                            {categories.map((category) => {
                                const categoryAssets = assets.filter((asset) => asset.category === category);
                                const isExpanded = expandedAssetCategories.includes(category);

                                return (
                                    <React.Fragment key={category}>
                                        <tr
                                            className="cursor-pointer bg-[#0D1117]/50 transition-colors hover:bg-[#161B22]"
                                            onClick={() => toggleAssetCategory(category)}
                                        >
                                            <td colSpan={6} className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight
                                                        size={14}
                                                        className={cn('text-[#8B949E] transition-transform', isExpanded && 'rotate-90')}
                                                    />
                                                    <span className="text-xs font-bold text-[#C9D1D9]">{category}</span>
                                                    <span className="text-[10px] text-[#484F58]">({categoryAssets.length} assets)</span>
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && categoryAssets.map((asset) => {
                                            const isSelected = selectedAssets.includes(asset.id);

                                            return (
                                                <tr
                                                    key={asset.id}
                                                    className={cn(
                                                        'group transition-all hover:bg-[#1C2128]',
                                                        isSelected && 'bg-[#00A3FF]/5 shadow-inner shadow-[#00A3FF]/10'
                                                    )}
                                                >
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => toggleAssetSelection(asset.id)}
                                                            className={cn(
                                                                'rounded p-1 transition-colors',
                                                                isSelected ? 'text-[#E36209]' : 'text-[#484F58] hover:text-[#E3B341]'
                                                            )}
                                                            title={isSelected ? 'Remove from watchlist' : 'Add to watchlist'}
                                                        >
                                                            <Star size={14} fill={isSelected ? 'currentColor' : 'none'} />
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-white transition-colors group-hover:text-[#00A3FF]">{asset.symbol}</span>
                                                            <span className="text-[10px] text-[#8B949E]">{asset.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-sm">
                                                        {isLoading && asset.price === '...' ? (
                                                            <div className="h-4 w-12 animate-pulse rounded bg-[#30363D]" />
                                                        ) : (
                                                            asset.price
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={cn(
                                                            'inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold',
                                                            asset.trend === 'up'
                                                                ? 'bg-[#3FB950]/10 text-[#3FB950]'
                                                                : asset.trend === 'down'
                                                                    ? 'bg-[#F85149]/10 text-[#F85149]'
                                                                    : 'bg-[#8B949E]/10 text-[#8B949E]'
                                                        )}>
                                                            {asset.trend === 'up' ? <ArrowUpRight size={14} className="mr-1" /> :
                                                                asset.trend === 'down' ? <ArrowDownRight size={14} className="mr-1" /> :
                                                                    <Minus size={14} className="mr-1" />}
                                                            {asset.change}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="rounded-md border border-[#30363D] bg-[#30363D]/30 px-2 py-1 text-[10px] font-bold text-[#8B949E]">
                                                            {asset.sector}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => toggleAssetSelection(asset.id)}
                                                            className={cn(
                                                                'rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all',
                                                                isSelected
                                                                    ? 'border-transparent bg-[#00A3FF] text-white'
                                                                    : 'border-[#30363D] text-[#8B949E] hover:border-[#00A3FF] hover:text-[#00A3FF]'
                                                            )}
                                                        >
                                                            {isSelected ? 'SELECTED' : 'SELECT'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
}
