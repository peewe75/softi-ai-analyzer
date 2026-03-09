import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { AnimatePresence } from 'motion/react';

// Types & Constants
import { Message, Asset, Tab } from '../types';
import { ASSET_DATABASE, DATA_FEEDS } from '../constants/market';

import { useUser } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';

// Components
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import OverviewTab from './dashboard/OverviewTab';
import AnalysisTab from './dashboard/AnalysisTab';
import FeedsTab from './dashboard/FeedsTab';
import AutomationTab from './dashboard/AutomationTab';
import ReportsTab from './dashboard/ReportsTab';
import SupportTab from './dashboard/SupportTab';
import SettingsTab from './dashboard/SettingsTab';

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

interface UserLimit {
    limit_key: string;
    limit_value: number | null;
    window: 'none' | 'daily' | 'monthly';
}

export default function MainDashboard() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken } = useAuth();
    const [synced, setSynced] = useState(false);
    const [userRole, setUserRole] = useState<string>('user');
    const [entitlements, setEntitlements] = useState<string[] | null>(null);
    const [limits, setLimits] = useState<Record<string, UserLimit>>({});
    const [limitNotice, setLimitNotice] = useState<string | null>(null);
    const [assets, setAssets] = useState<Asset[]>(() => {
        const cached = localStorage.getItem('softi_assets');
        return cached ? JSON.parse(cached) : ASSET_DATABASE;
    });

    if (!isLoaded || !isSignedIn) {
        return (
            <div className="h-screen w-screen bg-[#0A0E14] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    useEffect(() => {
        if (user && !synced) {
            const syncUser = async () => {
                try {
                    let token: string | null = null;
                    if (user) {
                        token = await getToken();
                    }

                    const headers: Record<string, string> = {
                        'Content-Type': 'application/json'
                    };
                        headers['Authorization'] = `Bearer ${token}`;

                    const response = await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            email: user?.primaryEmailAddress?.emailAddress,
                            firstName: user?.firstName,
                            lastName: user?.lastName
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setUserRole(data.profile?.role || 'user');
                        console.log('User synced with Supabase. Role:', data.profile?.role);
                    }
                } catch (error) {
                    console.error('Failed to sync user:', error);
                } finally {
                    setSynced(true);
                }
            };
            syncUser();
        }
    }, [user, synced, getToken]);

    useEffect(() => {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (!user && !isLocal) {
            return;
        }

        if (user && !synced) {
            return;
        }

        const loadEntitlements = async () => {
            let attempts = 0;
            try {
                let token: string | null = null;
                if (user) {
                    token = await getToken();
                }

                const headers: Record<string, string> = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const requestEntitlements = async (): Promise<void> => {
                    attempts += 1;
                    const response = await fetch('/api/me/entitlements', { headers });

                    if (response.status === 404 && attempts < 3) {
                        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
                        return requestEntitlements();
                    }

                    if (!response.ok) {
                        setEntitlements([]);
                        return;
                    }

                    const data = await response.json();
                    if (Array.isArray(data?.entitlements)) {
                        setEntitlements(data.entitlements);
                    } else {
                        setEntitlements([]);
                    }
                };

                await requestEntitlements();
            } catch (error) {
                console.error('Failed to load entitlements:', error);
                setEntitlements([]);
            }
        };

        loadEntitlements();
    }, [user, synced, getToken]);

    useEffect(() => {
        if (!user || !synced) {
            return;
        }

        const loadLimits = async () => {
            try {
                const token = await getToken();
                const response = await fetch('/api/me/limits', {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (!response.ok) {
                    setLimits({});
                    return;
                }

                const data = await response.json();
                setLimits(data?.limits || {});
            } catch (error) {
                console.error('Failed to load limits:', error);
                setLimits({});
            }
        };

        loadLimits();
    }, [user, synced, getToken]);

    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const tabEntitlements: Partial<Record<Tab, string[]>> = {
        analysis: ['basic_analysis', 'advanced_analysis'],
        feeds: ['basic_analysis'],
        automation: ['mt5_bridge'],
        reports: ['advanced_analysis', 'premium_signals'],
        support: ['premium_signals']
    };
    const [messages, setMessages] = useState<Message[]>([]);
    const [supportMessages, setSupportMessages] = useState<Message[]>([
        { id: 'welcome', role: 'assistant', content: "Benvenuto nel supporto finanziario di SOFTI AI. Sono il tuo **Trading Genius**, esperto senior in mercati globali, cripto, fondi assicurativi e trading algoritmico. Come posso assisterti oggi?", timestamp: new Date(), type: 'support' }
    ]);
    const [eaLogs, setEaLogs] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [supportInput, setSupportInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState<string[]>(['eurusd', 'xauusd', 'btc']);
    const [activeFeeds, setActiveFeeds] = useState<string[]>(['google']);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [expandedAssetCategories, setExpandedAssetCategories] = useState<string[]>(['Forex']);
    const [activeAI, setActiveAI] = useState<string>('gemini-pro');
    const [lastUpdate, setLastUpdate] = useState<Date>(() => {
        const cached = localStorage.getItem('softi_last_update');
        return cached ? new Date(cached) : new Date(0);
    });
    const [quotaError, setQuotaError] = useState<boolean>(false);
    
    // AI calls are now handled by the backend /api/ai/analyze endpoint

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supportEndRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);

    const refreshMarketData = async (isManual = false) => {
        if (isLoading) return;
        const now = new Date().getTime();
        const timeSinceLastUpdate = now - lastUpdate.getTime();

        if (isManual && timeSinceLastUpdate < 5000) return;
        if (!isManual && timeSinceLastUpdate < 120000) return; // 2 minutes

        setIsLoading(true);
        setQuotaError(false);
        try {
            const token = await getToken();
            const allSymbols = assets.map(a => a.symbol).join(', ');
            
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    type: 'market_data',
                    symbols: allSymbols,
                    model: "gemini-1.5-flash"
                })
            });

            if (!response.ok) throw new Error('Refresh failed');
            const data = await response.json();
            let rawText = data.content || "[]";
            
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) rawText = jsonMatch[0];
            const updatedData = JSON.parse(rawText);

            const newAssets = assets.map(asset => {
                const update = updatedData.find((u: any) => u.symbol.toLowerCase() === asset.symbol.toLowerCase());
                return update ? { ...asset, ...update } : asset;
            });

            setAssets(newAssets);
            const updateTime = new Date();
            setLastUpdate(updateTime);
            localStorage.setItem('softi_assets', JSON.stringify(newAssets));
            localStorage.setItem('softi_last_update', updateTime.toISOString());
        } catch (e: any) {
            console.error('Market data refresh failed:', e);
            if (e.message?.includes('429')) setQuotaError(true);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshMarketData(false);
        const interval = setInterval(() => refreshMarketData(false), 120000); // 2 minutes
        return () => clearInterval(interval);
    }, [lastUpdate, getToken]);

    useEffect(() => {
        const socket = io();
        socketRef.current = socket;
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));
        return () => { socket.disconnect(); };
    }, []);

    useEffect(() => {
        if (!entitlements) {
            return;
        }

        const required = tabEntitlements[activeTab];
        if (!required || required.length === 0) {
            return;
        }

        const normalized = new Set(entitlements.map((key) => normalizeEntitlement(key)));
        const canAccess = required.some((key) => normalized.has(normalizeEntitlement(key)));
        if (!canAccess) {
            setActiveTab('overview');
        }
    }, [activeTab, entitlements]);

    const toggleAssetSelection = (id: string) => {
        setSelectedAssets(prev => {
            if (prev.includes(id)) {
                return prev.filter(a => a !== id);
            }

            const cap = limits.max_assets_per_analysis?.limit_value;
            if (typeof cap === 'number' && cap > 0 && prev.length >= cap) {
                setLimitNotice(`Asset limit reached: your plan allows up to ${ cap } assets per analysis.`);
                return prev;
            }

            setLimitNotice(null);
            return [...prev, id];
        });
    };

    const toggleAssetCategory = (cat: string) => {
        setExpandedAssetCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const generateReport = async (type: 'daily' | 'weekly' | 'monthly') => {
        const cap = limits.max_assets_per_analysis?.limit_value;
        if (typeof cap === 'number' && cap > 0 && selectedAssets.length > cap) {
            setLimitNotice(`Reduce selected assets to ${ cap } or fewer for this plan.`);
            return;
        }

        if ((entitlements || []).includes('advanced_analysis')) {
            try {
                const token = await getToken();
                const consumeResponse = await fetch('/api/me/usage/consume', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        metric_key: 'advanced_analysis_requests',
                        amount: 1,
                        asset_count: selectedAssets.length,
                    }),
                });

                if (!consumeResponse.ok) {
                    const payload = await consumeResponse.json().catch(() => ({}));
                    setLimitNotice(payload?.message || 'Usage limit reached for your current plan.');
                    return;
                }
            } catch (error) {
                console.error('Failed to consume usage counter:', error);
                setLimitNotice('Unable to validate plan limits right now. Try again in a moment.');
                return;
            }
        }

        setLimitNotice(null);

        setIsLoading(true);
        setActiveTab('reports');
        const selectedSymbols = assets.filter(a => selectedAssets.includes(a.id)).map(a => a.symbol).join(', ');
        try {
            const token = await getToken();
                const response = await fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        type: 'report',
                        symbols: selectedSymbols,
                        prompt: `Genera report ${ type } `,
                        model: "gemini-1.5-pro"
                    })
                });

            if (!response.ok) throw new Error('Report generation failed');
            const data = await response.json();
            const msg: Message = { id: Date.now().toString(), role: 'assistant', content: data.content || "Errore.", timestamp: new Date(), type: 'report' };
            setMessages(prev => [...prev, msg]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalysis = async () => {
        if (!input.trim() || isLoading) return;

        const cap = limits.max_assets_per_analysis?.limit_value;
        if (typeof cap === 'number' && cap > 0 && selectedAssets.length > cap) {
            setLimitNotice(`Reduce selected assets to ${ cap } or fewer for this plan.`);
            return;
        }

        if ((entitlements || []).includes('advanced_analysis')) {
            try {
                const token = await getToken();
                const consumeResponse = await fetch('/api/me/usage/consume', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        metric_key: 'advanced_analysis_requests',
                        amount: 1,
                        asset_count: selectedAssets.length,
                    }),
                });

                if (!consumeResponse.ok) {
                    const payload = await consumeResponse.json().catch(() => ({}));
                    setLimitNotice(payload?.message || 'Usage limit reached for your current plan.');
                    return;
                }
            } catch (error) {
                console.error('Failed to consume usage counter:', error);
                setLimitNotice('Unable to validate plan limits right now. Try again in a moment.');
                return;
            }
        }

        setLimitNotice(null);
        const selectedSymbols = assets.filter(a => selectedAssets.includes(a.id)).map(a => a.symbol).join(', ');
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date(), type: 'chat' };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const token = await getToken();
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    type: 'analysis',
                    symbols: selectedSymbols,
                    prompt: input,
                    model: "gemini-1.5-pro"
                })
            });

            if (!response.ok) throw new Error('Analysis failed');
            const data = await response.json();
            const msg: Message = { 
                id: Date.now().toString(), 
                role: 'assistant', 
                content: data.content || "Errore.", 
                timestamp: new Date(), 
                type: 'chat' 
            };
            setMessages(prev => [...prev, msg]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const exportToPDF = async (elementId: string, title: string = 'Report') => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        setIsLoading(true);
        try {
            const dataUrl = await toPng(element, { 
                backgroundColor: '#0D1117',
                style: {
                    borderRadius: '0'
                }
            });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = (element.offsetHeight * imgWidth) / element.offsetWidth;
            
            pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`${ title.toLowerCase().replace(/\s+/g, '_') }.pdf`);
        } catch (e) {
            console.error('PDF Export failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#0A0E14] text-[#E1E4E8] font-sans overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} entitlements={entitlements} userRole={userRole} />
            <main className="flex-1 flex flex-col min-w-0 bg-[#0D1117]">
                <TopBar
                    isLoading={isLoading}
                    isConnected={isConnected}
                    refreshMarketData={refreshMarketData}
                    lastUpdate={lastUpdate}
                    userRole={userRole}
                />
                <div className="flex-1 overflow-y-auto min-w-0 p-6">
                    {limitNotice && (
                        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                            {limitNotice}
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                assets={assets}
                                selectedAssets={selectedAssets}
                                toggleAssetSelection={toggleAssetSelection}
                                isLoading={isLoading}
                                lastUpdate={lastUpdate}
                                expandedAssetCategories={expandedAssetCategories}
                                toggleAssetCategory={toggleAssetCategory}
                            />
                        )}
                        {activeTab === 'analysis' && (
                            <AnalysisTab
                                messages={messages}
                                input={input}
                                setInput={setInput}
                                handleAnalysis={handleAnalysis}
                                isLoading={isLoading}
                                selectedAssets={selectedAssets}
                                assets={assets}
                                messagesEndRef={messagesEndRef}
                            />
                        )}
                        {activeTab === 'feeds' && (
                            <FeedsTab dataFeeds={DATA_FEEDS} activeFeeds={activeFeeds} setActiveFeeds={setActiveFeeds} />
                        )}
                        {activeTab === 'automation' && (
                            <AutomationTab eaLogs={eaLogs} exportToPDF={exportToPDF} />
                        )}
                        {activeTab === 'reports' && (
                            <ReportsTab messages={messages} isLoading={isLoading} generateReport={generateReport} exportToPDF={exportToPDF} />
                        )}
                        {activeTab === 'support' && <SupportTab />}
                        {activeTab === 'settings' && <SettingsTab />}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
