import { useState, useRef, useEffect } from 'react';
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
import { useMt5Bridge } from '../hooks/useMt5Bridge';
import type { Mt5AnalyzerPayload, Mt5Notification } from '../mt5/types';

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
                let resolvedRole = 'user';
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
                        resolvedRole = data.profile?.role || resolvedRole;
                        console.log('User synced with Supabase. Role:', data.profile?.role);
                    }

                    // `/api/me` is the authoritative role source already used by the admin route guard.
                    // Read it here as well so the main dashboard sidebar does not fall back to "user"
                    // when Clerk/Supabase sync succeeds partially or returns stale role data.
                    const meResponse = await fetch('/api/me', { headers });
                    if (meResponse.ok) {
                        const payload = await meResponse.json();
                        resolvedRole = payload?.profile?.role || resolvedRole;
                    }
                } catch (error) {
                    console.error('Failed to sync user:', error);
                } finally {
                    setUserRole(resolvedRole);
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
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState<string[]>(['eurusd', 'xauusd', 'btc']);
    const [activeFeeds, setActiveFeeds] = useState<string[]>(() => {
        const cached = localStorage.getItem('softi_active_feeds');
        if (!cached) return ['google'];

        try {
            const parsed = JSON.parse(cached);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['google'];
        } catch {
            return ['google'];
        }
    });
    const [expandedAssetCategories, setExpandedAssetCategories] = useState<string[]>(['Forex']);
    const [lastUpdate, setLastUpdate] = useState<Date>(() => {
        const cached = localStorage.getItem('softi_last_update');
        return cached ? new Date(cached) : new Date(0);
    });
    const {
        bridgeStatus,
        marketRows,
        logs: eaLogs,
        notifications,
        startBridge,
        stopBridge,
        dismissNotification
    } = useMt5Bridge();
    const [toastAlert, setToastAlert] = useState<Mt5Notification | null>(null);
    const [mt5SelectedSymbol, setMt5SelectedSymbol] = useState<string | null>(null);
    const [mt5Analyzer, setMt5Analyzer] = useState<Mt5AnalyzerPayload | null>(null);
    const [mt5Question, setMt5Question] = useState('');
    const [mt5Answer, setMt5Answer] = useState('');
    const [mt5Loading, setMt5Loading] = useState(false);

    // AI calls are now handled by the backend /api/ai/analyze endpoint

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeFeedsKey = [...activeFeeds].sort().join(',');

    useEffect(() => {
        localStorage.setItem('softi_active_feeds', JSON.stringify(activeFeeds));
    }, [activeFeeds]);

    const refreshMarketData = async (isManual = false, force = false) => {
        if (isLoading) return;
        if (user && !synced) return;
        const now = new Date().getTime();
        const timeSinceLastUpdate = now - lastUpdate.getTime();

        if (!force) {
            if (isManual && timeSinceLastUpdate < 5000) return;
            if (!isManual && timeSinceLastUpdate < 120000) return; // 2 minutes
        }

        setIsLoading(true);
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
                    model: "gemini-1.5-flash",
                    activeFeeds,
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
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user && !synced) {
            return;
        }

        refreshMarketData(false);
        const interval = setInterval(() => refreshMarketData(false), 120000); // 2 minutes
        return () => clearInterval(interval);
    }, [lastUpdate, getToken, user, synced, activeFeedsKey]);

    useEffect(() => {
        if (user && !synced) {
            return;
        }

        setLastUpdate(new Date(0));
        localStorage.removeItem('softi_last_update');
        refreshMarketData(true, true);
    }, [activeFeedsKey, user, synced]);

    useEffect(() => {
        if (notifications.length === 0) return;
        setToastAlert(notifications[0]);
    }, [notifications]);

    useEffect(() => {
        if (!mt5SelectedSymbol) return;
        const loadAnalyzer = async () => {
            try {
                const response = await fetch(`/api/mt5/analyzer/${mt5SelectedSymbol}`);
                if (!response.ok) {
                    setMt5Analyzer(null);
                    return;
                }
                const payload = await response.json();
                setMt5Analyzer(payload?.analyzer || null);
            } catch (error) {
                console.error('Failed to load MT5 analyzer:', error);
                setMt5Analyzer(null);
            }
        };
        loadAnalyzer();
    }, [mt5SelectedSymbol]);

    useEffect(() => {
        if (!entitlements) {
            return;
        }

        if (userRole === 'admin' || userRole === 'owner') {
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
                setLimitNotice(`Asset limit reached: your plan allows up to ${cap} assets per analysis.`);
                return prev;
            }

            setLimitNotice(null);
            return [...prev, id];
        });
    };

    const toggleAssetCategory = (cat: string) => {
        setExpandedAssetCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const openInteractiveAnalysis = (symbol: string) => {
        setMt5SelectedSymbol(symbol.toUpperCase());
        setActiveTab('analysis');
    };

    const askMt5Question = async () => {
        if (!mt5SelectedSymbol || !mt5Question.trim() || mt5Loading) return;
        setMt5Loading(true);
        setMt5Answer('');
        try {
            const response = await fetch('/api/mt5/interactive-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: mt5SelectedSymbol,
                    question: mt5Question
                })
            });

            if (!response.ok) throw new Error('Interactive analysis failed');
            const data = await response.json();
            setMt5Answer(data.answer || 'Nessuna risposta disponibile.');
        } catch (error) {
            console.error(error);
            setMt5Answer('Errore durante l\'analisi interattiva.');
        } finally {
            setMt5Loading(false);
        }
    };

    const generateReport = async (type: 'daily' | 'weekly' | 'monthly') => {
        const cap = limits.max_assets_per_analysis?.limit_value;
        if (typeof cap === 'number' && cap > 0 && selectedAssets.length > cap) {
            setLimitNotice(`Reduce selected assets to ${cap} or fewer for this plan.`);
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
            const response = await fetch('/api/mt5/reports/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    timeframe: type
                })
            });

            if (!response.ok) throw new Error('Report generation failed');
            const data = await response.json();
            const msg: Message = { id: Date.now().toString(), role: 'assistant', content: data.markdown || "Errore.", timestamp: new Date(), type: 'report' };
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
            setLimitNotice(`Reduce selected assets to ${cap} or fewer for this plan.`);
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
            pdf.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
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
                    isConnected={bridgeStatus.active}
                    refreshMarketData={refreshMarketData}
                    lastUpdate={lastUpdate}
                    userRole={userRole}
                />
                <div className="flex-1 overflow-y-auto min-w-0 p-6">
                    {toastAlert && (
                        <div className="mb-4 rounded-lg border border-[#E3B341]/40 bg-[#E3B341]/10 px-4 py-3 text-xs text-[#F2CC60] flex items-center justify-between gap-3">
                            <span>{toastAlert.message}</span>
                            <button
                                onClick={() => {
                                    dismissNotification(toastAlert.id);
                                    setToastAlert(null);
                                }}
                                className="px-2 py-1 rounded bg-[#0D1117] border border-[#30363D] text-[#E1E4E8]"
                            >
                                Conferma
                            </button>
                        </div>
                    )}
                    {limitNotice && (
                        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                            {limitNotice}
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                assets={assets}
                                marketRows={marketRows}
                                selectedAssets={selectedAssets}
                                toggleAssetSelection={toggleAssetSelection}
                                onOpenInteractiveAnalysis={openInteractiveAnalysis}
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
                                toggleAssetSelection={toggleAssetSelection}
                                limitNotice={limitNotice}
                                messagesEndRef={messagesEndRef}
                            />
                        )}
                        {activeTab === 'feeds' && (
                            <FeedsTab dataFeeds={DATA_FEEDS} activeFeeds={activeFeeds} setActiveFeeds={setActiveFeeds} />
                        )}
                        {activeTab === 'automation' && (
                            <AutomationTab
                                bridgeStatus={bridgeStatus}
                                eaLogs={eaLogs}
                                exportToPDF={exportToPDF}
                                startBridge={startBridge}
                                stopBridge={stopBridge}
                            />
                        )}
                        {activeTab === 'reports' && (
                            <ReportsTab messages={messages} isLoading={isLoading} generateReport={generateReport} exportToPDF={exportToPDF} />
                        )}
                        {activeTab === 'support' && (
                            <SupportTab notifications={notifications} dismissNotification={dismissNotification} />
                        )}
                        {activeTab === 'settings' && <SettingsTab />}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
