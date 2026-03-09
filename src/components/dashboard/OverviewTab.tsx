import React from 'react';
import {
    TrendingUp, Activity, Search, Filter,
    ChevronRight, ArrowUpRight, ArrowDownRight,
    Minus, Star, Globe2, Newspaper
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Asset } from '../../types';

interface OverviewTabProps {
    assets: Asset[];
    selectedAssets: string[];
    toggleAssetSelection: (id: string) => void;
    isLoading: boolean;
    lastUpdate: Date;
    expandedAssetCategories: string[];
    toggleAssetCategory: (cat: string) => void;
}

export default function OverviewTab({
    assets,
    selectedAssets,
    toggleAssetSelection,
    isLoading,
    lastUpdate,
    expandedAssetCategories,
    toggleAssetCategory
}: OverviewTabProps) {
    const categories = Array.from(new Set(assets.map(a => a.category)));

    return (
        <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Market Pulse Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Market Status', value: 'OPEN', color: 'text-[#238636]', icon: Globe2 },
                    { label: 'Volatility Index', value: '14.2', color: 'text-[#E3B341]', icon: Activity },
                    { label: 'Daily Volume', value: '$4.2T', color: 'text-[#00A3FF]', icon: TrendingUp },
                    { label: 'News Sentiment', value: 'BULLISH', color: 'text-[#238636]', icon: Newspaper },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4">
                        <div className="p-2 bg-[#0D1117] rounded-lg">
                            <stat.icon size={18} className={stat.color} />
                        </div>
                        <div>
                            <p className="text-[10px] text-[#8B949E] font-bold uppercase tracking-wider">{stat.label}</p>
                            <p className={cn("text-lg font-black", stat.color)}>{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 bg-[#1C2128] border-b border-[#30363D] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-sm uppercase tracking-widest text-[#8B949E]">Global Asset Matrix</h3>
                        <div className="flex gap-2">
                            <span className="bg-[#238636]/10 text-[#238636] text-[10px] px-2 py-0.5 rounded-full border border-[#238636]/20 font-bold">LIVE</span>
                            <span className="bg-[#00A3FF]/10 text-[#00A3FF] text-[10px] px-2 py-0.5 rounded-full border border-[#00A3FF]/20 font-bold">AI GROUNDED</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-[#8B949E] hover:text-white transition-colors" title="Search assets"><Search size={16} /></button>
                        <button className="p-2 text-[#8B949E] hover:text-white transition-colors" title="Filter assets"><Filter size={16} /></button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#30363D] text-[10px] uppercase font-bold text-[#484F58]">
                                <th className="px-6 py-4 w-10 text-center">#</th>
                                <th className="px-6 py-4">Symbol</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">24h Change</th>
                                <th className="px-6 py-4">Sector</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#30363D]/50">
                            {categories.map(category => {
                                const categoryAssets = assets.filter(a => a.category === category);
                                const isExpanded = expandedAssetCategories.includes(category);

                                return (
                                    <React.Fragment key={category}>
                                        <tr
                                            className="bg-[#0D1117]/50 cursor-pointer hover:bg-[#161B22] transition-colors"
                                            onClick={() => toggleAssetCategory(category)}
                                        >
                                            <td colSpan={6} className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight size={14} className={cn("text-[#8B949E] transition-transform", isExpanded && "rotate-90")} />
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
                                                        "group hover:bg-[#1C2128] transition-all",
                                                        isSelected && "bg-[#00A3FF]/5 shadow-inner shadow-[#00A3FF]/10"
                                                    )}
                                                >
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => toggleAssetSelection(asset.id)}
                                                            className={cn(
                                                                "p-1 rounded transition-colors",
                                                                isSelected ? "text-[#E36209]" : "text-[#484F58] hover:text-[#E3B341]"
                                                            )}
                                                            title={isSelected ? "Remove from watchlist" : "Add to watchlist"}
                                                        >
                                                            <Star size={14} fill={isSelected ? "currentColor" : "none"} />
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-white group-hover:text-[#00A3FF] transition-colors">{asset.symbol}</span>
                                                            <span className="text-[10px] text-[#8B949E]">{asset.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-sm">
                                                        {isLoading && asset.price === '...' ? (
                                                            <div className="w-12 h-4 bg-[#30363D] animate-pulse rounded" />
                                                        ) : (
                                                            asset.price
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold",
                                                            asset.trend === 'up' ? "text-[#3FB950] bg-[#3FB950]/10" :
                                                                asset.trend === 'down' ? "text-[#F85149] bg-[#F85149]/10" :
                                                                    "text-[#8B949E] bg-[#8B949E]/10"
                                                        )}>
                                                            {asset.trend === 'up' ? <ArrowUpRight size={14} className="mr-1" /> :
                                                                asset.trend === 'down' ? <ArrowDownRight size={14} className="mr-1" /> :
                                                                    <Minus size={14} className="mr-1" />}
                                                            {asset.change}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] font-bold text-[#8B949E] bg-[#30363D]/30 px-2 py-1 rounded-md border border-[#30363D]">
                                                            {asset.sector}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => toggleAssetSelection(asset.id)}
                                                            className={cn(
                                                                "text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all",
                                                                isSelected ? "bg-[#00A3FF] border-transparent text-white" : "border-[#30363D] text-[#8B949E] hover:border-[#00A3FF] hover:text-[#00A3FF]"
                                                            )}
                                                        >
                                                            {isSelected ? 'SELECTED' : 'SELECT'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
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
