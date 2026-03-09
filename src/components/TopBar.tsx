import React from 'react';
import {
    Search, Bell, RefreshCw, Loader2, Sparkles, User, Settings, ShieldCheck
} from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
interface TopBarProps {
    isLoading: boolean;
    isConnected: boolean;
    refreshMarketData: (isManual: boolean) => void;
    lastUpdate: Date;
    userRole?: string;
}

export default function TopBar({
    isLoading,
    isConnected,
    refreshMarketData,
    lastUpdate,
    userRole
}: TopBarProps) {
    return (
        <header className="h-20 bg-[#0D1117]/80 backdrop-blur-xl border-b border-[#30363D] flex items-center justify-between px-8 sticky top-0 z-50">
            <div className="flex items-center gap-6 flex-1 max-w-2xl">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B949E] group-focus-within:text-[#00A3FF] transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search assets, news, or ask Trading Genius..."
                        className="w-full bg-[#161B22] border border-[#30363D] rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-[#00A3FF] transition-all group-hover:border-[#484F58]"
                    />
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden lg:flex flex-col items-end">
                    <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-[#238636] animate-pulse" : "bg-[#DA3633]")} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B949E]">
                            {isConnected ? 'Bridge Active' : 'Bridge Offline'}
                        </span>
                    </div>
                    <p className="text-[10px] text-[#484F58]">MT5 Gateway v2.9</p>
                </div>

                <button
                    onClick={() => refreshMarketData(true)}
                    disabled={isLoading}
                    className="p-3 bg-[#161B22] border border-[#30363D] rounded-xl hover:bg-[#30363D] transition-all group flex items-center gap-3"
                    title={`Last update: ${lastUpdate.toLocaleTimeString()}`}
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin text-[#00A3FF]" /> : <RefreshCw size={18} className="text-[#8B949E] group-hover:rotate-180 transition-transform duration-500" />}
                    <span className="text-xs font-bold text-[#8B949E] group-hover:text-white transition-colors">Refresh</span>
                </button>

                <div className="h-8 w-px bg-[#30363D]" />

                <div className="flex items-center gap-4">
                    <button className="p-2 text-[#8B949E] hover:text-white relative" title="Notifications">
                        <Bell size={20} />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-[#00A3FF] rounded-full border-2 border-[#0D1117]" />
                    </button>

                    {(userRole === 'admin' || userRole === 'owner') && (
                        <Link
                            to="/admin"
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-all"
                            title="Admin Management"
                        >
                            <ShieldCheck size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-tight">Admin</span>
                        </Link>
                    )}

                    <div className="bg-[#238636]/10 text-[#238636] px-3 py-1.5 rounded-lg border border-[#238636]/20 flex items-center gap-2">
                        <Sparkles size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">PRO PLAN</span>
                    </div>

                    <UserButton afterSignOutUrl="/" />
                </div>
            </div>
        </header>
    );
}
