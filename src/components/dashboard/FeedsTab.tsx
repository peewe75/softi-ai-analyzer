import React from 'react';
import {
    Database, CheckCircle2, X, Lock,
    Upload, Search, Filter
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { DataFeed } from '../../types';

interface FeedsTabProps {
    dataFeeds: DataFeed[];
    activeFeeds: string[];
    setActiveFeeds: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function FeedsTab({
    dataFeeds,
    activeFeeds,
    setActiveFeeds
}: FeedsTabProps) {
    return (
        <motion.div
            key="feeds"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#00A3FF]/5 blur-[100px] pointer-events-none" />
                <div className="flex items-center gap-4 z-10">
                    <div className="p-3 bg-[#0D1117] rounded-xl border border-[#30363D]">
                        <Database size={24} className="text-[#00A3FF]" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Enterprise Data Feeds</h2>
                        <p className="text-sm text-[#8B949E]">Gestisci le fonti di dati e le API esterne della piattaforma.</p>
                    </div>
                </div>
                <div className="flex gap-3 z-10 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-[#0D1117] px-4 py-2 rounded-xl border border-[#30363D] flex-1 md:flex-none">
                        <span className="text-[10px] font-bold text-[#8B949E]">HEALTH STATUS:</span>
                        <span className="text-xs font-black text-[#238636] uppercase tracking-widest">99.9% Uptime</span>
                    </div>
                    <button className="bg-[#00A3FF] text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-[#0081CC] transition-all shadow-lg shadow-[#00A3FF]/20">
                        CONNECT NEW API
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dataFeeds.map(feed => {
                    const isSelected = activeFeeds.includes(feed.id);
                    return (
                        <div key={feed.id} className={cn(
                            "bg-[#161B22] border rounded-2xl p-6 transition-all group flex flex-col justify-between h-[220px] shadow-lg",
                            isSelected ? "border-[#238636] bg-[#238636]/5" : "border-[#30363D] hover:border-[#484F58]"
                        )}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black tracking-widest text-[#484F58] uppercase">Provider: {feed.provider}</span>
                                    <span className={cn(
                                        "inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit",
                                        feed.type === 'free' ? "bg-[#238636]/10 text-[#238636]" : "bg-[#E36209]/10 text-[#E36209]"
                                    )}>
                                        {feed.type}
                                    </span>
                                </div>
                                <span className={cn(
                                    "flex items-center gap-1 text-[9px] font-bold uppercase",
                                    feed.status === 'active' ? "text-[#238636]" : "text-[#DA3633]"
                                )}>
                                    {feed.status === 'active' ? <CheckCircle2 size={10} /> : <X size={10} />} {feed.status}
                                </span>
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold text-lg text-white group-hover:text-[#00A3FF] transition-colors">{feed.name}</h3>
                                <p className="text-xs text-[#8B949E] mt-1 line-clamp-2">{feed.description}</p>
                            </div>

                            <button
                                onClick={() => {
                                    if (feed.status === 'active') {
                                        setActiveFeeds(prev =>
                                            prev.includes(feed.id)
                                                ? prev.filter(f => f !== feed.id)
                                                : [...prev, feed.id]
                                        );
                                    }
                                }}
                                disabled={feed.status === 'inactive'}
                                className={cn(
                                    "w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                    feed.status === 'inactive' ? "bg-[#30363D] text-[#8B949E] cursor-not-allowed border border-[#484F58]/30" :
                                        isSelected ? "bg-[#238636] text-white shadow-lg shadow-[#238636]/20" : "bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:border-[#00A3FF] hover:text-white"
                                )}
                            >
                                {feed.status === 'inactive' ?
                                    <span className="flex items-center justify-center gap-2"><Lock size={12} /> Access Restricted</span> :
                                    isSelected ? "Connected" : "Authorize Feed"}
                            </button>
                        </div>
                    )
                })}
            </div>
        </motion.div>
    );
}
