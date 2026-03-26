'use client';
import React, { useState, useMemo } from 'react';
import {
    Send, Bot, User, Loader2, Sparkles, Search, Check
} from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { Message, Asset } from '../../types/index';

interface AnalysisTabProps {
    messages: Message[];
    input: string;
    setInput: (val: string) => void;
    handleAnalysis: () => void;
    isLoading: boolean;
    selectedAssets: string[];
    assets: Asset[];
    toggleAssetSelection: (id: string) => void;
    limitNotice: string | null;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const CATEGORY_ORDER = ['Forex', 'Crypto', 'Commodities', 'Indices', 'Bonds'];

export default function AnalysisTab({
    messages,
    input,
    setInput,
    handleAnalysis,
    isLoading,
    selectedAssets,
    assets,
    toggleAssetSelection,
    limitNotice,
    messagesEndRef,
}: AnalysisTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const categories = useMemo(() => {
        const found = Array.from(new Set(assets.map(a => a.category)));
        return CATEGORY_ORDER.filter(c => found.includes(c)).concat(found.filter(c => !CATEGORY_ORDER.includes(c)));
    }, [assets]);

    const filteredAssets = useMemo(() => {
        return assets.filter(a => {
            const matchSearch = !searchQuery || a.symbol.toLowerCase().includes(searchQuery.toLowerCase());
            const matchCat = !categoryFilter || a.category === categoryFilter;
            return matchSearch && matchCat;
        });
    }, [assets, searchQuery, categoryFilter]);

    const selectedAssetObjects = assets.filter(a => selectedAssets.includes(a.id));

    return (
        <motion.div
            key="analysis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-[calc(100vh-140px)] flex flex-col gap-4"
        >
            {/* ── ASSET SELECTOR ── */}
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Seleziona Asset da Analizzare</h3>
                        <p className="text-[11px] text-[#8B949E] mt-0.5">
                            {selectedAssets.length > 0
                                ? `${selectedAssets.length} asset selezionati: ${selectedAssetObjects.map(a => a.symbol).join(', ')}`
                                : 'Nessun asset selezionato'}
                        </p>
                    </div>
                    {selectedAssets.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap justify-end max-w-xs">
                            {selectedAssetObjects.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => toggleAssetSelection(a.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00A3FF]/20 border border-[#00A3FF]/40 text-[#00A3FF] text-[10px] font-bold hover:bg-[#00A3FF]/30 transition-colors"
                                >
                                    <Check size={9} />
                                    {a.symbol}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search + category filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E7681]" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Cerca simbolo..."
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#00A3FF] transition-colors"
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => setCategoryFilter(null)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors',
                                !categoryFilter
                                    ? 'bg-[#00A3FF]/20 border-[#00A3FF]/40 text-[#00A3FF]'
                                    : 'border-[#30363D] text-[#6E7681] hover:text-white hover:border-[#484F58]'
                            )}
                        >
                            Tutti
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors',
                                    categoryFilter === cat
                                        ? 'bg-[#00A3FF]/20 border-[#00A3FF]/40 text-[#00A3FF]'
                                        : 'border-[#30363D] text-[#6E7681] hover:text-white hover:border-[#484F58]'
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Asset chips */}
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {filteredAssets.map(asset => {
                        const isSelected = selectedAssets.includes(asset.id);
                        return (
                            <button
                                key={asset.id}
                                onClick={() => toggleAssetSelection(asset.id)}
                                className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all',
                                    isSelected
                                        ? 'bg-[#00A3FF]/20 border-[#00A3FF]/50 text-[#00A3FF]'
                                        : 'bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:text-white hover:border-[#484F58]'
                                )}
                            >
                                {isSelected && <Check size={9} className="shrink-0" />}
                                {asset.symbol}
                            </button>
                        );
                    })}
                    {filteredAssets.length === 0 && (
                        <p className="text-[11px] text-[#6E7681] py-2">Nessun asset trovato</p>
                    )}
                </div>

                {limitNotice && (
                    <p className="mt-3 text-[11px] text-[#F85149] bg-[#DA3633]/10 border border-[#DA3633]/20 rounded-lg px-3 py-2">
                        {limitNotice}
                    </p>
                )}
            </div>

            {/* ── AI STRATEGY ENGINE CHAT ── */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#0D1117] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="px-6 py-4 bg-[#161B22] border-b border-[#30363D] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#00A3FF]/10 flex items-center justify-center">
                            <Sparkles size={16} className="text-[#00A3FF]" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Strategy Engine</h3>
                            <p className="text-[10px] text-[#8B949E]">
                                {selectedAssets.length > 0
                                    ? `Analizzando ${selectedAssets.length} asset`
                                    : 'Seleziona gli asset in alto per iniziare'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-[#30363D]">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 text-center space-y-4">
                            <Bot size={48} className="text-[#8B949E]" />
                            <p className="text-sm max-w-xs">Seleziona uno o più asset in alto, poi chiedi un'analisi approfondita. L'AI userà i dati in tempo reale.</p>
                        </div>
                    ) : (
                        messages.filter(m => m.type === 'chat').map((m) => (
                            <div key={m.id} className={cn("flex gap-4 max-w-[90%]", m.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg",
                                    m.role === 'user' ? "bg-[#00A3FF]" : "bg-[#238636]"
                                )}>
                                    {m.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                                </div>
                                <div className={cn(
                                    "p-4 rounded-2xl text-sm leading-relaxed border transition-all",
                                    m.role === 'user'
                                        ? "bg-[#1C2128] border-[#00A3FF]/30 text-white"
                                        : "bg-[#161B22] border-[#30363D] text-[#C9D1D9] shadow-xl"
                                )}>
                                    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-[#0D1117] prose-pre:border prose-pre:border-[#30363D]">
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                    <div className="mt-2 text-[9px] font-bold uppercase opacity-40">
                                        {m.timestamp.toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-[#161B22] border-t border-[#30363D] shrink-0">
                    <div className="max-w-4xl mx-auto flex gap-3">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalysis()}
                            placeholder={selectedAssets.length > 0
                                ? `Analizza ${selectedAssetObjects.map(a => a.symbol).join(', ')}...`
                                : "Seleziona prima gli asset in alto..."}
                            disabled={selectedAssets.length === 0}
                            className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00A3FF] shadow-inner transition-all disabled:opacity-50"
                        />
                        <button
                            onClick={handleAnalysis}
                            disabled={isLoading || !input.trim() || selectedAssets.length === 0}
                            className={cn(
                                "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
                                isLoading || !input.trim() || selectedAssets.length === 0
                                    ? "bg-[#30363D] text-[#8B949E] cursor-not-allowed"
                                    : "bg-[#00A3FF] text-white hover:bg-[#0081CC] shadow-lg shadow-[#00A3FF]/20 active:scale-95"
                            )}
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            <span className="hidden sm:inline uppercase tracking-widest text-xs">Analyze</span>
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
