import React from 'react';
import {
    Send, Bot, User, Loader2, Sparkles,
    Search, Filter, Trash2, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { Message, Asset } from '../../types';
import type { Mt5AnalyzerPayload, Mt5MarketOverviewRow } from '../../mt5/types';

interface AnalysisTabProps {
    messages: Message[];
    input: string;
    setInput: (val: string) => void;
    handleAnalysis: () => void;
    isLoading: boolean;
    selectedAssets: string[];
    assets: Asset[];
    marketRows: Mt5MarketOverviewRow[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    mt5SelectedSymbol: string | null;
    mt5Analyzer: Mt5AnalyzerPayload | null;
    mt5Answer: string;
    mt5Question: string;
    mt5Loading: boolean;
    onSelectMt5Symbol: (symbol: string) => void;
    onChangeMt5Question: (value: string) => void;
    onAskMt5Question: () => void;
}

export default function AnalysisTab({
    messages,
    input,
    setInput,
    handleAnalysis,
    isLoading,
    selectedAssets,
    assets,
    marketRows,
    messagesEndRef,
    mt5SelectedSymbol,
    mt5Analyzer,
    mt5Answer,
    mt5Question,
    mt5Loading,
    onSelectMt5Symbol,
    onChangeMt5Question,
    onAskMt5Question
}: AnalysisTabProps) {
    const selectedAssetObjects = assets.filter(a => selectedAssets.includes(a.id));

    return (
        <motion.div
            key="analysis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-[calc(100vh-140px)] flex flex-col gap-6"
        >
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    {marketRows.slice(0, 20).map((row) => (
                        <button
                            key={row.symbol}
                            onClick={() => onSelectMt5Symbol(row.symbol)}
                            className={cn(
                                'px-2.5 py-1 text-[11px] rounded-md border font-semibold',
                                mt5SelectedSymbol === row.symbol
                                    ? 'bg-[#00A3FF]/20 border-[#00A3FF]/40 text-[#00A3FF]'
                                    : 'border-[#30363D] text-[#8B949E] hover:text-white hover:border-[#00A3FF]/30'
                            )}
                        >
                            {row.symbol}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-4">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-[#8B949E] mb-3">JSON Context</h4>
                        <pre className="text-[11px] text-[#C9D1D9] max-h-64 overflow-auto whitespace-pre-wrap">
                            {mt5Analyzer ? JSON.stringify(mt5Analyzer, null, 2) : 'Seleziona un asset dalla Market Overview per caricare analyzer_[SYMBOL].json'}
                        </pre>
                    </div>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-4 flex flex-col gap-3">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-[#8B949E]">Interactive Analysis (Gemini)</h4>
                        <textarea
                            value={mt5Question}
                            onChange={(event) => onChangeMt5Question(event.target.value)}
                            placeholder="Perche l'oro ha confidenza 85%?"
                            className="min-h-24 bg-[#161B22] border border-[#30363D] rounded-lg p-3 text-sm focus:outline-none focus:border-[#00A3FF]"
                        />
                        <button
                            onClick={onAskMt5Question}
                            disabled={!mt5SelectedSymbol || !mt5Question.trim() || mt5Loading}
                            className="self-start px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-[#00A3FF] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mt5Loading ? 'Analisi in corso...' : 'Chiedi a Gemini'}
                        </button>
                        <div className="text-sm text-[#C9D1D9] border border-[#30363D] rounded-lg p-3 min-h-24 bg-[#161B22]">
                            {mt5Answer || 'La risposta comparira qui.'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-[#0D1117] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
                {/* Chat Header */}
                <div className="px-6 py-4 bg-[#161B22] border-b border-[#30363D] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#00A3FF]/10 flex items-center justify-center">
                            <Sparkles size={16} className="text-[#00A3FF]" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Strategy Engine</h3>
                            <p className="text-[10px] text-[#8B949E]">Analyzing {selectedAssets.length} selected assets</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {selectedAssetObjects.map(asset => (
                            <span key={asset.id} className="text-[10px] font-bold bg-[#30363D] text-[#C9D1D9] px-2 py-1 rounded border border-[#484F58]">
                                {asset.symbol}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-[#30363D]">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 text-center space-y-4">
                            <Bot size={48} className="text-[#8B949E]" />
                            <p className="text-sm max-w-xs">Chiedi un'analisi approfondita sugli asset selezionati. L'AI userà i dati in tempo reale.</p>
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

                {/* Input Area */}
                <div className="p-4 bg-[#161B22] border-t border-[#30363D] shrink-0">
                    <div className="max-w-4xl mx-auto flex gap-3 relative">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalysis()}
                            placeholder="Inserisci un comando per l'AI (es. 'Analizza la correlazione tra XAUUSD e BTC')..."
                            className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00A3FF] shadow-inner transition-all"
                        />
                        <button
                            onClick={handleAnalysis}
                            disabled={isLoading || !input.trim()}
                            className={cn(
                                "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
                                isLoading || !input.trim()
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
