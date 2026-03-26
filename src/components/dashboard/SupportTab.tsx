import React from 'react';
import {
    LifeBuoy, MessageSquare, BookOpen, ExternalLink, ShieldCheck, Mail, BellRing, Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { Mt5Notification } from '../../mt5/types';

interface SupportTabProps {
    notifications: Mt5Notification[];
    dismissNotification: (id: string) => void;
}

export default function SupportTab({ notifications, dismissNotification }: SupportTabProps) {
    const supportTickets = [
        { id: 'TKT-8842', subject: 'API Latency Optimization', status: 'Resolved', date: '2024-03-05' },
        { id: 'TKT-8891', subject: 'Custom EA Bridge Config', status: 'Open', date: '2024-03-07' },
    ];

    return (
        <motion.div
            key="support"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4">
                <LifeBuoy size={20} className="text-[#00A3FF]" />
                <p className="text-xs text-[#8B949E]">
                    **Trading Genius (Expert AI assistance)** mostra alert proattivi quando arrivano setup ad alta confidenza in sessioni deboli.
                </p>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#30363D] bg-[#1C2128] flex items-center gap-2">
                    <BellRing size={16} className="text-[#E3B341]" />
                    <h3 className="text-sm font-bold uppercase text-[#8B949E] tracking-widest">Proactive Signals</h3>
                </div>
                <div className="divide-y divide-[#30363D]">
                    {notifications.length === 0 ? (
                        <div className="p-6 text-sm text-[#8B949E]">Nessun avviso attivo.</div>
                    ) : notifications.map((item) => (
                        <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm text-white">{item.message}</p>
                                <p className="text-xs text-[#8B949E] mt-1">Confidence: {Math.round(item.confidence_score * 100)}% • Sessione: {item.session_quality_label}</p>
                            </div>
                            <button
                                onClick={() => dismissNotification(item.id)}
                                className="inline-flex items-center gap-2 text-xs border border-[#238636]/30 text-[#3FB950] bg-[#238636]/10 rounded-lg px-3 py-2 hover:bg-[#238636]/20"
                            >
                                <Check size={13} /> Conferma
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#00A3FF] transition-all group">
                    <div className="w-12 h-12 bg-[#1C2128] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#00A3FF]/10 text-[#8B949E] group-hover:text-[#00A3FF] transition-all">
                        <MessageSquare size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">Live Chat</h4>
                    <p className="text-xs text-[#8B949E] mb-4">Parla con un esperto di sistemi di trading quantitativo.</p>
                    <button className="w-full py-2.5 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs font-bold hover:bg-[#1C2128] transition-all text-[#8B949E] hover:text-white uppercase tracking-widest">
                        Avvia Chat
                    </button>
                </div>

                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#238636] transition-all group">
                    <div className="w-12 h-12 bg-[#1C2128] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#238636]/10 text-[#8B949E] group-hover:text-[#238636] transition-all">
                        <BookOpen size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">Documentazione</h4>
                    <p className="text-xs text-[#8B949E] mb-4">Guide complete all'integrazione API e bridge MT5.</p>
                    <button className="w-full py-2.5 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs font-bold hover:bg-[#1C2128] transition-all text-[#8B949E] hover:text-white flex items-center justify-center gap-2 uppercase tracking-widest">
                        Sfoglia Guide <ExternalLink size={14} />
                    </button>
                </div>

                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 hover:border-[#E3B341] transition-all group">
                    <div className="w-12 h-12 bg-[#1C2128] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#E3B341]/10 text-[#8B949E] group-hover:text-[#E3B341] transition-all">
                        <ShieldCheck size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">Status System</h4>
                    <p className="text-xs text-[#8B949E] mb-4">Monitora in tempo reale lo stato dei server globali.</p>
                    <button className="w-full py-2.5 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs font-bold hover:bg-[#1C2128] transition-all text-[#8B949E] hover:text-white uppercase tracking-widest">
                        Controlla Status
                    </button>
                </div>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-[#30363D] bg-[#1C2128] flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-[#8B949E] tracking-widest">Recent Support Tickets</h3>
                    <button className="text-[10px] font-bold text-[#00A3FF] hover:underline uppercase tracking-tighter">View All</button>
                </div>
                <div className="divide-y divide-[#30363D]">
                    {supportTickets.map(ticket => (
                        <div key={ticket.id} className="p-6 hover:bg-[#1C2128] transition-all cursor-pointer flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#0D1117] border border-[#30363D] rounded-lg flex items-center justify-center text-[#8B949E] group-hover:text-[#00A3FF] transition-all">
                                    <Mail size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-[#8B949E]">{ticket.id}</span>
                                        <h5 className="text-sm font-bold text-[#C9D1D9]">{ticket.subject}</h5>
                                    </div>
                                    <p className="text-[10px] text-[#484F58]">Ultimo aggiornamento: {ticket.date}</p>
                                </div>
                            </div>
                            <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                                ticket.status === 'Resolved' ? "bg-[#238636]/10 text-[#238636] border-[#238636]/20" : "bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/20 animate-pulse"
                            )}>
                                {ticket.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
