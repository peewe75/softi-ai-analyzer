import React from 'react';
import {
    FileBarChart, Upload, Loader2, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { Message } from '../../types';

interface ReportsTabProps {
    messages: Message[];
    isLoading: boolean;
    generateReport: (type: 'daily' | 'weekly' | 'monthly') => void;
    exportToPDF: (elementId: string, title: string) => void;
}

export default function ReportsTab({
    messages,
    isLoading,
    generateReport,
    exportToPDF
}: ReportsTabProps) {
    return (
        <motion.div
            key="reports"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4 shadow-lg">
                <FileBarChart size={20} className="text-[#00A3FF]" />
                <p className="text-xs text-[#8B949E]">
                    **Market Reports** genera sintesi periodiche (Daily/Weekly/Monthly) dell'intelligenza di mercato. Ogni report analizza il contesto macro e tecnico globale in tempo reale.
                </p>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#00A3FF]/10 blur-[50px] rounded-full" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#238636]/10 blur-[50px] rounded-full" />

                <div className="w-20 h-20 bg-[#00A3FF]/10 text-[#00A3FF] rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-[#00A3FF]/20 relative z-10">
                    <FileBarChart size={40} />
                </div>

                <div className="space-y-2 relative z-10">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Market Intelligence Hub</h3>
                    <p className="text-sm text-[#8B949E] max-w-md mx-auto">Genera report istituzionali basati sui dati globali e flussi MT5 sincronizzati.</p>
                </div>

                <div className="flex justify-center gap-4 relative z-10">
                    {[
                        { type: 'daily' as const, color: 'bg-[#00A3FF] hover:bg-[#0081CC]', label: 'Daily Report' },
                        { type: 'weekly' as const, color: 'bg-[#238636] hover:bg-[#2EA043]', label: 'Weekly Report' },
                        { type: 'monthly' as const, color: 'bg-[#E3B341] hover:bg-[#D2A230]', label: 'Monthly Report' },
                    ].map((btn) => (
                        <button
                            key={btn.type}
                            onClick={() => generateReport(btn.type)}
                            disabled={isLoading}
                            className={cn(
                                btn.color,
                                "text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                            )}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence>
                    {isLoading && (
                        <motion.div
                            key="loading-indicator"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex items-center justify-center gap-3 p-4 mt-4 bg-[#0D1117] border border-[#30363D] rounded-2xl max-w-xs mx-auto"
                        >
                            <Loader2 className="text-[#00A3FF] animate-spin" size={20} />
                            <span className="text-sm font-bold text-[#00A3FF] uppercase tracking-tighter">
                                Generazione Documento...
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="space-y-6">
                {messages.filter(m => m.type === 'report').reverse().map(report => (
                    <div key={report.id} className="bg-[#161B22] border border-[#30363D] rounded-2xl p-8 shadow-xl" id={`report-${report.id}`}>
                        <div className="flex justify-between items-center mb-6 border-b border-[#30363D] pb-6">
                            <div className="flex items-center gap-3">
                                <Sparkles size={18} className="text-[#E3B341]" />
                                <span className="text-xs font-black uppercase text-[#00A3FF] tracking-widest">
                                    Intelligence Report • {report.timestamp.toLocaleDateString()}
                                </span>
                            </div>
                            <button
                                onClick={() => exportToPDF(`report-${report.id}`, `Market_Report_${report.timestamp.getTime()}`)}
                                className="text-[#8B949E] hover:text-white p-2.5 bg-[#0D1117] border border-[#30363D] rounded-xl transition-all hover:border-[#00A3FF]"
                                title="Export report to PDF"
                            >
                                <Upload size={18} />
                            </button>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-full break-words whitespace-pre-wrap text-[#C9D1D9]">
                            <ReactMarkdown>{report.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
