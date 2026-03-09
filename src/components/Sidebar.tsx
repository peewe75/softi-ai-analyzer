import React from 'react';
import {
    BarChart3, LayoutDashboard, Database, Zap,
    FileBarChart, Headphones, Settings, LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Tab } from '../types';
import { SignOutButton } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

interface SidebarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    entitlements?: string[] | null;
    userRole?: string;
}

const ENTITLEMENT_ALIASES: Record<string, string> = {
    analysis: 'basic_analysis',
    'feature.analysis': 'basic_analysis',
    'pro.analysis': 'advanced_analysis',
    feeds: 'basic_analysis',
    'feature.feeds': 'basic_analysis',
    'data.feeds': 'basic_analysis',
    automation: 'mt5_bridge',
    'feature.automation': 'mt5_bridge',
    'ea.automation': 'mt5_bridge',
    reports: 'advanced_analysis',
    'feature.reports': 'advanced_analysis',
    'market.reports': 'advanced_analysis',
    support: 'premium_signals',
    'feature.support': 'premium_signals',
    'trading.support': 'premium_signals',
};

function normalizeEntitlement(key: string): string {
    const lowered = key.trim().toLowerCase();
    return ENTITLEMENT_ALIASES[lowered] || lowered;
}

function hasEntitlement(entitlements: string[] | null | undefined, requiredAny?: string[]) {
    if (!requiredAny || requiredAny.length === 0) return true;
    if (!entitlements || entitlements.length === 0) return false;

    const normalized = new Set(entitlements.map((key) => normalizeEntitlement(key)));
    return requiredAny.some((key) => normalized.has(normalizeEntitlement(key)));
}

export default function Sidebar({ activeTab, setActiveTab, entitlements, userRole }: SidebarProps) {
    const menuItems = [
        { id: 'overview', icon: LayoutDashboard, label: 'Market Overview', desc: 'Real-time global market grid' },
        { id: 'analysis', icon: Database, label: 'Interactive Analysis', desc: 'Deep dive AI research', requiredAny: ['basic_analysis', 'advanced_analysis'] },
        { id: 'feeds', icon: Database, label: 'Data Sources', desc: 'Manage 7+ data providers', requiredAny: ['basic_analysis'] },
        { id: 'automation', icon: Zap, label: 'EA Automation', desc: 'MT5 Bridge active', requiredAny: ['mt5_bridge'] },
        { id: 'reports', icon: FileBarChart, label: 'Market Reports', desc: 'Daily/Weekly intelligence', requiredAny: ['advanced_analysis', 'premium_signals'] },
        { id: 'support', icon: Headphones, label: 'Trading Genius', desc: 'Expert AI assistance', requiredAny: ['premium_signals'] },
    ];

    const isAdmin = userRole === 'admin' || userRole === 'owner';
    const visibleMenuItems = menuItems.filter((item) => isAdmin || hasEntitlement(entitlements, item.requiredAny));

    return (
        <aside className="w-20 md:w-64 bg-[#141921] flex flex-col border-r border-[#2D333B] transition-all">
            <div className="p-6 flex items-center gap-3 border-b border-[#2D333B]">
                <div className="bg-[#00A3FF] p-2 rounded-lg shadow-lg shadow-[#00A3FF]/20">
                    <BarChart3 className="text-white" size={20} />
                </div>
                <span className="hidden md:block font-bold text-white tracking-tighter text-xl">
                    SOFTI <span className="text-[#00A3FF]">PRO</span>
                </span>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1">
                {visibleMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as Tab)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                                isActive
                                    ? "bg-[#00A3FF] text-white shadow-lg shadow-[#00A3FF]/20"
                                    : "text-[#8B949E] hover:bg-[#1C2128] hover:text-white"
                            )}
                        >
                            <Icon size={20} className={cn("shrink-0", isActive ? "text-white" : "group-hover:text-[#00A3FF]")} />
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-bold tracking-tight">{item.label}</p>
                                <p className={cn("text-[10px] opacity-70", isActive ? "text-blue-100" : "text-[#8B949E]")}>
                                    {item.desc}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-[#2D333B] space-y-1">
                <button
                    onClick={() => setActiveTab('settings')}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                        activeTab === 'settings' ? "bg-[#30363D] text-white" : "text-[#8B949E] hover:bg-[#1C2128]"
                    )}
                >
                    <Settings size={20} />
                    <span className="hidden md:block text-sm font-bold">Settings</span>
                </button>

                {(userRole === 'admin' || userRole === 'owner') && (
                    <Link
                        to="/admin"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-purple-400 hover:bg-purple-500/10 transition-all border border-transparent hover:border-purple-500/20"
                    >
                        <Shield size={20} />
                        <span className="hidden md:block text-sm font-bold">Admin Portal</span>
                    </Link>
                )}

                <div className="pt-1">
                    <SignOutButton>
                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#DA3633] hover:bg-[#DA3633]/10 transition-all">
                            <LogOut size={20} />
                            <span className="hidden md:block text-sm font-bold">Logout</span>
                        </button>
                    </SignOutButton>
                </div>
            </div>
        </aside>
    );
}
