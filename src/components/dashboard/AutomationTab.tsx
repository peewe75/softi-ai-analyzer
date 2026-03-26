import React from 'react';
import { Zap, Upload, Play, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { Mt5BridgeStatus, Mt5RealtimeLog } from '../../mt5/types';

interface AutomationTabProps {
    bridgeStatus: Mt5BridgeStatus;
    eaLogs: Mt5RealtimeLog[];
    exportToPDF: (elementId: string, title: string) => void;
    startBridge: () => Promise<void>;
    stopBridge: () => Promise<void>;
}

export default function AutomationTab({ bridgeStatus, eaLogs, exportToPDF, startBridge, stopBridge }: AutomationTabProps) {
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
                        **EA Automation (MT5 Bridge active)** riceve i pacchetti JSON/CSV dagli EA e li inoltra in tempo reale alla dashboard.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={startBridge}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-[#238636]/30 bg-[#238636]/10 text-[#3FB950] hover:bg-[#238636]/20"
                    >
                        <Play size={13} /> Start
                    </button>
                    <button
                        onClick={stopBridge}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-[#DA3633]/30 bg-[#DA3633]/10 text-[#F85149] hover:bg-[#DA3633]/20"
                    >
                        <Square size={13} /> Stop
                    </button>
                    <button
                        onClick={() => exportToPDF('ea-automation-log', 'EA_Automation')}
                        className="p-2 bg-[#1C2128] hover:bg-[#30363D] text-[#8B949E] hover:text-white rounded-lg transition-colors"
                        title="Export logs to PDF"
                    >
                        <Upload size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-[#0D1117] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 bg-[#161B22] border-b border-[#30363D] flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-[#8B949E] flex items-center gap-2 tracking-widest">
                        <Zap size={16} className="text-[#E3B341]" /> Bidirectional Traffic Log
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', bridgeStatus.active ? 'bg-[#238636] animate-pulse' : 'bg-[#DA3633]')} />
                        <span className={cn('text-[10px] font-mono font-bold', bridgeStatus.active ? 'text-[#238636]' : 'text-[#DA3633]')}>
                            {bridgeStatus.active ? 'MT5 BRIDGE ACTIVE' : 'MT5 BRIDGE STOPPED'}
                        </span>
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
                                log.source === 'webhook' ? 'bg-[#161B22] border-[#30363D]' : 'bg-[#238636]/5 border-[#238636]/20'
                            )}>
                                <div className="flex justify-between text-[#8B949E] mb-3 text-[10px] font-bold">
                                    <span className="bg-[#0D1117] px-2 py-0.5 rounded border border-[#30363D]">[{new Date(log.received_at).toLocaleTimeString()}]</span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded border",
                                        log.source === 'webhook' ? 'text-[#00A3FF] border-[#00A3FF]/20 bg-[#00A3FF]/5' : 'text-[#238636] border-[#238636]/20 bg-[#238636]/5'
                                    )}>
                                        {log.source === 'webhook' ? 'EA_INPUT_STREAM' : 'FILE_WATCH_STREAM'}
                                    </span>
                                </div>
                                <pre className="whitespace-pre-wrap text-[#C9D1D9] leading-relaxed break-all font-mono">{JSON.stringify(log.payload, null, 2)}</pre>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
}
