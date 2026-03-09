import React from 'react';
import {
    Settings, User, Lock, Bell, Database, HardDrive, Cpu, Globe, Key, CreditCard
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function SettingsTab() {
    return (
        <motion.div
            key="settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8 max-w-4xl mx-auto"
        >
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Account & Platform Settings</h2>
                <p className="text-sm text-[#8B949E]">Gestisci le tue preferenze, le connessioni API e i parametri di sicurezza.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar Settings Nav */}
                <div className="flex flex-col gap-1 md:col-span-1">
                    {[
                        { id: 'profile', icon: User, label: 'Profilo' },
                        { id: 'security', icon: Lock, label: 'Sicurezza' },
                        { id: 'billing', icon: CreditCard, label: 'Billing' },
                        { id: 'api', icon: Key, label: 'API Access' },
                        { id: 'notifications', icon: Bell, label: 'Notifiche' },
                        { id: 'bridge', icon: Cpu, label: 'MT5 Bridge' }
                    ].map((item, i) => (
                        <button
                            key={item.id}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all uppercase tracking-widest",
                                i === 0 ? "bg-[#00A3FF] text-white shadow-lg" : "text-[#8B949E] hover:text-white hover:bg-[#161B22]"
                            )}
                        >
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Settings Content */}
                <div className="md:col-span-3 space-y-8">
                    <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-[#30363D]">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Globe size={18} className="text-[#00A3FF]" /> Regional Connectivity
                            </h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-[#8B949E] uppercase tracking-widest mb-2">Preferred Server Node</label>
                                    <select
                                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00A3FF] transition-all"
                                        title="Select preferred server node"
                                    >
                                        <option>AWS East (N. Virginia) - Optimization for Global Pairs</option>
                                        <option>London (LD4) - Ultra Low Latency for FX</option>
                                        <option>Tokyo (TY3) - Asia-Pacific Node</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-[#0D1117] border border-[#30363D] rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <Database size={18} className="text-[#8B949E]" />
                                        <div>
                                            <h5 className="text-xs font-bold text-white uppercase tracking-tighter">Cloud Synchronization</h5>
                                            <p className="text-[10px] text-[#484F58]">Backup automatico dei log e delle analisi su Supabase.</p>
                                        </div>
                                    </div>
                                    <div className="w-12 h-6 bg-[#238636] rounded-full relative flex items-center transition-all cursor-pointer">
                                        <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 shadow-md transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <HardDrive size={18} className="text-[#238636]" /> Storage & Data Efficiency
                            </h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h5 className="text-xs font-bold text-white uppercase tracking-tighter">Clear Local Cache</h5>
                                        <p className="text-[10px] text-[#484F58]">Pulisce i dati di mercato temporanei salvati nel browser.</p>
                                    </div>
                                    <button className="px-4 py-2 bg-[#DA3633]/10 text-[#DA3633] border border-[#DA3633]/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#DA3633] hover:text-white transition-all">
                                        Reset Sync
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-[#1C2128] border-t border-[#30363D] flex justify-end">
                            <button className="px-10 py-3 bg-[#238636] text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#2EA043] transition-all shadow-xl active:scale-95">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
