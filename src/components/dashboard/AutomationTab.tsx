import React from 'react';
import { Zap, Upload, CheckCircle2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Message } from '../../types';

interface AutomationTabProps {
    eaLogs: Message[];
    exportToPDF: (elementId: string, title: string) => void;
}

export default function AutomationTab({ eaLogs, exportToPDF }: AutomationTabProps) {
    return (
        <motion.div
            key="automation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col gap-6"
        >
            <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Zap size={20} className="text-[#E3B341]" />
                    <p className="text-xs text-[#8B949E]">
                        **EA Automation** è il ponte tra MetaTrader 5 e l'AI. Riceve i segnali e i dati dal tuo **EA ADDESTRATOR**, li analizza e invia risposte operative istantanee che l'EA può eseguire.
                    </p>
                </div>
                <button
                    onClick={() => exportToPDF('ea-automation-log', 'EA_Automation')}
                    className="p-2 bg-[#1C2128] hover:bg-[#30363D] text-[#8B949E] hover:text-white rounded-lg transition-colors"
                    title="Export logs to PDF"
                >
                    <Upload size={16} />
                </button>
            </div>

            <div className="flex-1 flex flex-col bg-[#0D1117] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 bg-[#161B22] border-b border-[#30363D] flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-[#8B949E] flex items-center gap-2 tracking-widest">
                        <Zap size={16} className="text-[#E3B341]" /> Bidirectional Traffic Log
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#238636] animate-pulse rounded-full" />
                        <span className="text-[10px] font-mono text-[#238636] font-bold">MT5 BRIDGE ACTIVE</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 font-mono text-[12px] space-y-4" id="ea-automation-log">
                    {eaLogs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[#30363D] opacity-50 italic">
                            Waiting for incoming EA data packets...
                        </div>
                    ) : (
                        eaLogs.map(log => (
                            <div key={log.id} className={cn(
                                "p-4 border rounded-xl transition-all hover:bg-[#1C2128]",
                                log.content.includes('INTERROGAZIONE') ? "bg-[#161B22] border-[#30363D]" : "bg-[#238636]/5 border-[#238636]/20"
                            )}>
                                <div className="flex justify-between text-[#8B949E] mb-3 text-[10px] font-bold">
                                    <span className="bg-[#0D1117] px-2 py-0.5 rounded border border-[#30363D]">[{log.timestamp.toLocaleTimeString()}]</span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded border",
                                        log.content.includes('INTERROGAZIONE') ? "text-[#00A3FF] border-[#00A3FF]/20 bg-[#00A3FF]/5" : "text-[#238636] border-[#238636]/20 bg-[#238636]/5"
                                    )}>
                                        {log.content.includes('INTERROGAZIONE') ? 'EA_INPUT_STREAM' : 'AI_RESPONSE_PAYLOAD'}
                                    </span>
                                </div>
                                <pre className="whitespace-pre-wrap text-[#C9D1D9] leading-relaxed break-all font-mono">{log.content}</pre>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
}
