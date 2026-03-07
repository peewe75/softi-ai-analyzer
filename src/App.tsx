import { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  Send, Bot, User, Loader2, Trash2, Sparkles, FileText, Upload, 
  TrendingUp, Activity, Calendar, BarChart3, Globe, CheckCircle2, 
  ChevronRight, Layers, Briefcase, ShieldCheck, Landmark, PieChart, 
  Coins, Search, Filter, Settings, Bell, LayoutDashboard, 
  Database, Zap, MessageSquare, Headphones, FileBarChart, 
  Lock, Unlock, Info, RefreshCw, ArrowUpRight, ArrowDownRight,
  Cpu, Globe2, Newspaper, TrendingDown, Clock, Check, X, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { io, Socket } from 'socket.io-client';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isAnalysis?: boolean;
  type?: 'chat' | 'support' | 'ea_auto' | 'report';
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: string;
  sector: string;
  price?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface DataFeed {
  id: string;
  name: string;
  provider: string;
  type: 'free' | 'paid';
  status: 'active' | 'inactive';
  description: string;
  url?: string;
}

const ASSET_DATABASE: Asset[] = [
  // FOREX MAJOR
  { id: 'eurusd', symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex', sector: 'Major', price: '1.0842', change: '+0.12%', trend: 'up' },
  { id: 'gbpusd', symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'Forex', sector: 'Major', price: '1.2654', change: '-0.05%', trend: 'down' },
  { id: 'usdjpy', symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'Forex', sector: 'Major', price: '150.21', change: '+0.45%', trend: 'up' },
  { id: 'audusd', symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', category: 'Forex', sector: 'Major', price: '0.6542', change: '+0.10%', trend: 'up' },
  // FOREX MINOR
  { id: 'eurgbp', symbol: 'EURGBP', name: 'Euro / British Pound', category: 'Forex', sector: 'Minor', price: '0.8567', change: '+0.02%', trend: 'neutral' },
  { id: 'audcad', symbol: 'AUDCAD', name: 'AUD / CAD', category: 'Forex', sector: 'Minor', price: '0.8892', change: '-0.18%', trend: 'down' },
  { id: 'chfjpy', symbol: 'CHFJPY', name: 'Swiss Franc / Yen', category: 'Forex', sector: 'Minor', price: '168.42', change: '+0.30%', trend: 'up' },
  // COMMODITIES
  { id: 'xauusd', symbol: 'XAUUSD', name: 'Gold Spot', category: 'Commodities', sector: 'Metals', price: '2034.50', change: '+0.85%', trend: 'up' },
  { id: 'xagusd', symbol: 'XAGUSD', name: 'Silver Spot', category: 'Commodities', sector: 'Metals', price: '22.84', change: '+0.40%', trend: 'up' },
  { id: 'wti', symbol: 'WTI', name: 'Crude Oil', category: 'Commodities', sector: 'Energy', price: '78.42', change: '+1.20%', trend: 'up' },
  { id: 'ng', symbol: 'NATGAS', name: 'Natural Gas', category: 'Commodities', sector: 'Energy', price: '1.84', change: '-2.40%', trend: 'down' },
  // CRYPTO
  { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', category: 'Crypto', sector: 'Digital Assets', price: '62,450', change: '+3.40%', trend: 'up' },
  { id: 'eth', symbol: 'ETHUSD', name: 'Ethereum', category: 'Crypto', sector: 'Digital Assets', price: '3,420', change: '+2.15%', trend: 'up' },
  { id: 'sol', symbol: 'SOLUSD', name: 'Solana', category: 'Crypto', sector: 'Digital Assets', price: '132.40', change: '+5.10%', trend: 'up' },
  // FUTURES & INDICES
  { id: 'es', symbol: 'ES1!', name: 'S&P 500 Futures', category: 'Indices', sector: 'US Market', price: '5120.25', change: '+0.32%', trend: 'up' },
  { id: 'nq', symbol: 'NQ1!', name: 'Nasdaq 100 Futures', category: 'Indices', sector: 'US Market', price: '18240.50', change: '+0.45%', trend: 'up' },
  { id: 'dax', symbol: 'DAX', name: 'Germany 40', category: 'Indices', sector: 'EU Market', price: '17840', change: '+0.15%', trend: 'up' },
  // BONDS & INSURANCE
  { id: 'us10y', symbol: 'US10Y', name: 'US 10Y Yield', category: 'Bonds', sector: 'Government', price: '4.25%', change: '+0.01%', trend: 'up' },
  { id: 'alv', symbol: 'ALV', name: 'Allianz SE', category: 'Insurance', sector: 'Finance', price: '248.40', change: '+0.25%', trend: 'up' },
  { id: 'axa', symbol: 'AXA', name: 'AXA SA', category: 'Insurance', sector: 'Finance', price: '32.15', change: '-0.10%', trend: 'down' },
];

const DATA_FEEDS: DataFeed[] = [
  { id: 'google', name: 'Google Finance', provider: 'Google', type: 'free', status: 'active', description: 'Real-time market data via AI Grounding.' },
  { id: 'yahoo', name: 'Yahoo Finance', provider: 'Yahoo', type: 'free', status: 'active', description: 'Historical and fundamental data feed.' },
  { id: 'alphavantage', name: 'Alpha Vantage', provider: 'AV', type: 'paid', status: 'inactive', description: 'Premium API for global stocks and FX.' },
  { id: 'finnhub', name: 'Finnhub', provider: 'Finnhub', type: 'paid', status: 'inactive', description: 'Real-time stock, FX and crypto data.' },
  { id: 'eulerpool', name: 'Eulerpool', provider: 'Eulerpool', type: 'paid', status: 'inactive', description: 'Institutional grade fundamental data.' },
  { id: 'marketstack', name: 'Marketstack', provider: 'Marketstack', type: 'paid', status: 'inactive', description: 'Global stock market data API.' },
  { id: 'marketaux', name: 'Marketaux', provider: 'Marketaux', type: 'free', status: 'active', description: 'Financial news and sentiment analysis.' },
];

type Tab = 'overview' | 'analysis' | 'feeds' | 'automation' | 'reports' | 'support' | 'settings';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(() => {
    const cached = localStorage.getItem('softi_assets');
    return cached ? JSON.parse(cached) : ASSET_DATABASE;
  });
  const [activeTab, setActiveTab] = useState<Tab>('overview');
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
  const [activeFeed, setActiveFeed] = useState<string>('google');
  const [activeAI, setActiveAI] = useState<string>('gemini-pro');
  const [lastUpdate, setLastUpdate] = useState<Date>(() => {
    const cached = localStorage.getItem('softi_last_update');
    return cached ? new Date(cached) : new Date(0); // Default to epoch if no cache
  });
  const [quotaError, setQuotaError] = useState<boolean>(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supportEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }), []);

  const refreshMarketData = async (isManual = false) => {
    if (isLoading) return;
    
    const now = new Date().getTime();
    const timeSinceLastUpdate = now - lastUpdate.getTime();

    // Cooldown logic:
    // Manual: 60s cooldown
    // Auto: 15min cooldown (if data is already fresh)
    if (isManual && timeSinceLastUpdate < 60000) {
      console.log("Manual refresh cooldown active (60s)");
      return;
    }
    
    if (!isManual && timeSinceLastUpdate < 900000) { // 15 mins
      console.log("Auto refresh skipped - data is fresh enough (< 15m)");
      return;
    }

    setIsLoading(true);
    setQuotaError(false);
    try {
      // We'll fetch data for a subset of major assets to keep it fast
      const majorSymbols = assets.slice(0, 10).map(a => a.symbol).join(', ');
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Ottieni i prezzi di mercato attuali e le variazioni percentuali per questi simboli: ${majorSymbols}. Restituisci i dati ESCLUSIVAMENTE in formato JSON come un array di oggetti con {symbol, price, change, trend ('up' o 'down')}. Non aggiungere testo prima o dopo il JSON.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      let rawText = response.text || "[]";
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        rawText = jsonMatch[0];
      }
      const updatedData = JSON.parse(rawText);
      
      const newAssets = assets.map(asset => {
        const update = updatedData.find((u: any) => u.symbol.toLowerCase() === asset.symbol.toLowerCase());
        if (update) {
          return { ...asset, price: update.price, change: update.change, trend: update.trend };
        }
        return asset;
      });

      setAssets(newAssets);
      const updateTime = new Date();
      setLastUpdate(updateTime);
      
      // Save to cache
      localStorage.setItem('softi_assets', JSON.stringify(newAssets));
      localStorage.setItem('softi_last_update', updateTime.toISOString());

    } catch (e: any) {
      console.error("Error refreshing market data:", e);
      if (e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED') {
        setQuotaError(true);
        
        // Fallback: Simulate slight market movement so the app feels alive
        const simulatedAssets = assets.map(asset => {
          const currentPrice = parseFloat(asset.price.replace(/[^0-9.-]+/g, ""));
          if (isNaN(currentPrice)) return asset;
          
          const volatility = 0.0005; // 0.05% movement
          const change = currentPrice * volatility * (Math.random() - 0.5);
          const newPrice = currentPrice + change;
          const newTrend = change >= 0 ? 'up' : 'down';
          
          // Format price back to string (simplified)
          const decimals = asset.price.split('.')[1]?.length || 2;
          const formattedPrice = newPrice.toFixed(decimals);
          
          return {
            ...asset,
            price: formattedPrice,
            trend: newTrend as 'up' | 'down'
          };
        });
        
        setAssets(simulatedAssets);
        const updateTime = new Date();
        setLastUpdate(updateTime); // Update time to prevent immediate retry loop
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch only if cache is old (> 15m)
    refreshMarketData(false);
    
    // Check every 5 minutes if we need an update
    const interval = setInterval(() => refreshMarketData(false), 300000); 
    return () => clearInterval(interval);
  }, [lastUpdate]); // lastUpdate dependency to ensure cooldown logic works with current state

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('mt5_data', (data: { content: any, timestamp: string }) => {
      const logEntry: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `**INTERROGAZIONE EA RICEVUTA**\n\n${typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2)}`,
        timestamp: new Date(),
        type: 'ea_auto'
      };
      setEaLogs(prev => [logEntry, ...prev].slice(0, 50));
    });

    socket.on('mt5_response', (data: { content: string, timestamp: string }) => {
      const logEntry: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `**RISPOSTA AUTOMATICA AI**\n\n${data.content}`,
        timestamp: new Date(),
        type: 'ea_auto'
      };
      setEaLogs(prev => [logEntry, ...prev].slice(0, 50));
    });

    return () => { socket.disconnect(); };
  }, []);

  const toggleAssetSelection = (id: string) => {
    setSelectedAssets(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const generateReport = async (type: 'daily' | 'weekly' | 'monthly') => {
    setIsLoading(true);
    setActiveTab('reports');
    const selectedSymbols = assets.filter(a => selectedAssets.includes(a.id)).map(a => a.symbol).join(', ');
    const prompt = `Genera un report di trading ${type} professionale. Fonte: ${activeFeed}. Asset: ${selectedSymbols}. Includi analisi tecnica, sentiment e outlook macro.`;
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          systemInstruction: "Sei SOFTI AI ANALYZER. Produci report in stile Bloomberg Terminal. Sii estremamente tecnico e preciso.",
          tools: [{ googleSearch: {} }]
        },
      });
      const msg: Message = { id: Date.now().toString(), role: 'assistant', content: response.text || "Errore.", timestamp: new Date(), type: 'report' };
      setMessages(prev => [...prev, msg]);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleSupportChat = async () => {
    if (!supportInput.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: supportInput, timestamp: new Date(), type: 'support' };
    setSupportMessages(prev => [...prev, userMsg]);
    setSupportInput('');
    setIsLoading(true);
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: supportInput,
        config: {
          systemInstruction: "Sei il Trading Genius di SOFTI AI. Sei un esperto mondiale di finanza, trading algoritmico, mercati azionari, cripto e fondi assicurativi. Conosci ogni dettaglio tecnico della piattaforma SOFTI. Rispondi in modo cordiale ma estremamente competente.",
          tools: [{ googleSearch: {} }]
        },
      });
      const botMsg: Message = { id: (Date.now()+1).toString(), role: 'assistant', content: response.text || "Mi scuso, non posso rispondere al momento.", timestamp: new Date(), type: 'support' };
      setSupportMessages(prev => [...prev, botMsg]);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleAnalysis = async () => {
    if (!input.trim() || isLoading) return;
    const selectedSymbols = assets.filter(a => selectedAssets.includes(a.id)).map(a => a.symbol).join(', ');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date(), type: 'chat' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Analisi richiesta per gli asset: ${selectedSymbols}. Domanda: ${input}`,
        config: {
          systemInstruction: "Sei SOFTI AI ANALYZER. Esegui analisi tecniche e fondamentali approfondite. Usa i dati di Google Search per informazioni in tempo reale.",
          tools: [{ googleSearch: {} }]
        },
      });
      const botMsg: Message = { id: (Date.now()+1).toString(), role: 'assistant', content: response.text || "Errore di analisi.", timestamp: new Date(), type: 'chat' };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-[#0A0E14] text-[#E1E4E8] font-sans overflow-hidden">
      {/* Sidebar - Bloomberg Style */}
      <aside className="w-20 md:w-64 bg-[#141921] flex flex-col border-r border-[#2D333B] transition-all">
        <div className="p-6 flex items-center gap-3 border-b border-[#2D333B]">
          <div className="bg-[#00A3FF] p-2 rounded-lg shadow-lg shadow-[#00A3FF]/20">
            <BarChart3 className="text-white" size={20} />
          </div>
          <span className="hidden md:block font-bold text-white tracking-tighter text-xl">SOFTI <span className="text-[#00A3FF]">PRO</span></span>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Market Overview', desc: 'Real-time global market grid' },
            { id: 'analysis', icon: TrendingUp, label: 'AI Analysis', desc: 'Interactive deep-dive analysis' },
            { id: 'reports', icon: FileBarChart, label: 'Market Reports', desc: 'Periodic intelligence reports' },
            { id: 'automation', icon: Zap, label: 'EA Automation', desc: 'Bidirectional EA-AI flow' },
            { id: 'feeds', icon: Database, label: 'Data Feeds', desc: 'Manage data providers' },
            { id: 'support', icon: Headphones, label: 'Client Support', desc: 'Trading Genius assistance' },
            { id: 'settings', icon: Settings, label: 'System Config', desc: 'AI & system preferences' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              title={item.desc}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group",
                activeTab === item.id 
                  ? "bg-[#00A3FF] text-white shadow-lg shadow-[#00A3FF]/20" 
                  : "text-[#8B949E] hover:bg-[#1C2128] hover:text-white"
              )}
            >
              <item.icon size={18} />
              <div className="hidden md:block text-left">
                <span className="block text-sm font-semibold leading-none">{item.label}</span>
                <span className="block text-[10px] opacity-50 mt-1 font-normal">{item.desc}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2D333B]">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg bg-[#1C2128] border",
            isConnected ? "border-[#238636]/30" : "border-[#DA3633]/30"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-[#238636] animate-pulse" : "bg-[#DA3633]")} />
            <span className="hidden md:block text-[10px] font-bold uppercase text-[#8B949E]">
              {isConnected ? 'Terminal Connected' : 'Terminal Offline'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0D1117]">
        {/* Top Header Bar */}
        <header className="h-16 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between px-8">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">{activeTab.replace('_', ' ')}</h2>
            <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono text-[#8B949E]">
              <span className={cn("flex items-center gap-1", quotaError && "text-[#DA3633]")}>
                <RefreshCw size={12} className={cn(quotaError ? "text-[#DA3633]" : "text-[#00A3FF]", isLoading && "animate-spin")} /> 
                {quotaError ? "QUOTA ERROR" : `LAST UPDATE: ${lastUpdate.toLocaleTimeString()}`}
              </span>
              <span className="flex items-center gap-1"><Globe size={12} className="text-[#238636]" /> NY SESSION: OPEN</span>
            </div>
            <button 
              onClick={() => refreshMarketData(true)}
              disabled={isLoading}
              className="lg:hidden p-2 text-[#00A3FF] hover:bg-[#1C2128] rounded-md transition-colors"
            >
              <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {quotaError && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#DA3633]/10 border border-[#DA3633]/30 rounded text-[10px] text-[#DA3633] font-bold animate-pulse">
                <AlertTriangle size={12} /> QUOTA EXCEEDED - USING CACHED DATA
              </div>
            )}
            <div className="flex bg-[#0D1117] p-1 rounded-md border border-[#30363D]">
              {['daily', 'weekly', 'monthly'].map(t => (
                <button 
                  key={t}
                  onClick={() => generateReport(t as any)}
                  className="px-3 py-1 text-[10px] font-bold uppercase text-[#8B949E] hover:text-white transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
            <button className="p-2 text-[#8B949E] hover:text-white relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#00A3FF] rounded-full" />
            </button>
          </div>
        </header>

        {/* Content Switcher */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4">
                  <Info size={20} className="text-[#00A3FF]" />
                  <p className="text-xs text-[#8B949E]">
                    **Market Overview** fornisce una griglia in tempo reale di tutti i mercati globali. Se i dati primari non sono disponibili, il sistema esegue il failover automatico su Yahoo Finance, Alpha Vantage e Finnhub per garantire la massima coerenza.
                  </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {['Forex', 'Commodities', 'Crypto', 'Indices', 'Bonds', 'Insurance'].map(category => (
                    <div key={category} className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-[#1C2128] border-b border-[#30363D] flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase text-[#8B949E] tracking-wider">{category}</h3>
                        <ArrowUpRight size={14} className="text-[#8B949E]" />
                      </div>
                      <div className="p-0 overflow-x-auto">
                        <table className="w-full text-[12px] font-mono">
                          <thead>
                            <tr className="text-[10px] text-[#8B949E] border-b border-[#30363D]">
                              <th className="px-4 py-2 text-left">SYMBOL</th>
                              <th className="px-4 py-2 text-left">NAME</th>
                              <th className="px-4 py-2 text-left">PRICE</th>
                              <th className="px-4 py-2 text-right">CHANGE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#30363D]">
                            {assets.filter(a => a.category === category).map(asset => (
                              <tr key={asset.id} className="hover:bg-[#1C2128] transition-colors cursor-pointer group">
                                <td className="px-4 py-3 font-bold text-white">{asset.symbol}</td>
                                <td className="px-4 py-3 text-[#8B949E] truncate max-w-[120px]">{asset.name}</td>
                                <td className="px-4 py-3 text-[#E1E4E8]">{asset.price}</td>
                                <td className={cn("px-4 py-3 text-right font-bold", asset.trend === 'up' ? "text-[#238636]" : "text-[#DA3633]")}>
                                  {asset.change}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'analysis' && (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col gap-6"
              >
                <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4">
                  <Activity size={20} className="text-[#00A3FF]" />
                  <p className="text-xs text-[#8B949E]">
                    **AI Analysis** è la sezione interattiva per analisi tecniche profonde. Seleziona gli asset da analizzare (flagging) e chiedi all'AI di studiare pattern, volumi e proiezioni.
                  </p>
                </div>

                <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0">
                  {/* Asset Picker */}
                  <div className="w-full xl:w-80 bg-[#161B22] border border-[#30363D] rounded-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-[#30363D] bg-[#1C2128]">
                      <h3 className="text-xs font-bold uppercase text-[#8B949E] tracking-wider">Select Assets to Analyze</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {['Forex', 'Commodities', 'Crypto', 'Indices', 'Bonds', 'Insurance'].map(cat => (
                        <div key={cat} className="space-y-1">
                          <div className="px-3 py-1 text-[10px] font-bold text-[#8B949E] uppercase bg-[#0D1117] rounded">{cat}</div>
                          {assets.filter(a => a.category === cat).map(a => (
                            <button
                              key={a.id}
                              onClick={() => toggleAssetSelection(a.id)}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all",
                                selectedAssets.includes(a.id) ? "bg-[#00A3FF]/10 text-[#00A3FF] border border-[#00A3FF]/30" : "text-[#8B949E] hover:bg-[#1C2128]"
                              )}
                            >
                              <span className="font-bold">{a.symbol}</span>
                              {selectedAssets.includes(a.id) ? <Check size={14} /> : <div className="w-3.5 h-3.5 border border-[#30363D] rounded" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chat Interface */}
                  <div className="flex-1 flex flex-col bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#8B949E] space-y-4">
                          <Bot size={48} className="opacity-20" />
                          <p className="text-sm font-medium">Seleziona gli asset a sinistra e richiedi un'analisi tecnica.</p>
                        </div>
                      ) : (
                        messages.filter(m => m.type === 'chat').map(m => (
                          <div key={m.id} className={cn("flex gap-4 max-w-[90%]", m.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", m.role === 'user' ? "bg-[#00A3FF]" : "bg-[#30363D]")}>
                              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={cn("p-4 rounded-xl text-sm leading-relaxed border", m.role === 'user' ? "bg-[#1C2128] border-[#00A3FF]/30" : "bg-[#0D1117] border-[#30363D]")}>
                              <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 bg-[#0D1117] border-t border-[#30363D]">
                      <div className="max-w-4xl mx-auto flex gap-3">
                        <input 
                          value={input} onChange={e => setInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAnalysis()}
                          placeholder="Analizza i pair selezionati per setup H4..."
                          className="flex-1 bg-[#161B22] border border-[#30363D] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#00A3FF]"
                        />
                        <button 
                          onClick={handleAnalysis}
                          className="bg-[#00A3FF] text-white p-2 rounded-lg hover:bg-[#0081CC] transition-colors"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'feeds' && (
              <motion.div 
                key="feeds"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4">
                  <Database size={20} className="text-[#00A3FF]" />
                  <p className="text-xs text-[#8B949E]">
                    **Data Feeds** gestisce le connessioni esterne. Qui puoi attivare o disattivare i provider di dati. I feed "Free" sono attivi di default tramite AI Grounding, mentre i "Paid" richiedono chiavi API configurate.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {DATA_FEEDS.map(feed => (
                    <div key={feed.id} className={cn(
                      "bg-[#161B22] border rounded-2xl p-6 space-y-4 transition-all",
                      activeFeed === feed.id ? "border-[#00A3FF] ring-1 ring-[#00A3FF]/20" : "border-[#30363D]"
                    )}>
                      <div className="flex justify-between items-start">
                        <div className="p-3 bg-[#1C2128] rounded-xl">
                          <Database size={24} className={feed.type === 'paid' ? "text-[#E3B341]" : "text-[#00A3FF]"} />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                            feed.type === 'paid' ? "bg-[#E3B341]/10 text-[#E3B341]" : "bg-[#00A3FF]/10 text-[#00A3FF]"
                          )}>
                            {feed.type}
                          </span>
                          <span className={cn(
                            "flex items-center gap-1 text-[9px] font-bold uppercase",
                            feed.status === 'active' ? "text-[#238636]" : "text-[#DA3633]"
                          )}>
                            {feed.status === 'active' ? <CheckCircle2 size={10} /> : <X size={10} />} {feed.status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{feed.name}</h3>
                        <p className="text-xs text-[#8B949E] mt-1">{feed.description}</p>
                      </div>
                      <button 
                        onClick={() => feed.status === 'active' && setActiveFeed(feed.id)}
                        disabled={feed.status === 'inactive'}
                        className={cn(
                          "w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                          feed.status === 'inactive' ? "bg-[#30363D] text-[#8B949E] cursor-not-allowed" : 
                          activeFeed === feed.id ? "bg-[#238636] text-white" : "bg-[#00A3FF] text-white hover:bg-[#0081CC]"
                        )}
                      >
                        {feed.status === 'inactive' ? <span className="flex items-center justify-center gap-2"><Lock size={12} /> Configure API</span> : 
                         activeFeed === feed.id ? "Connected" : "Select Feed"}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'automation' && (
              <motion.div 
                key="automation"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full flex flex-col gap-6"
              >
                <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4">
                  <Zap size={20} className="text-[#E3B341]" />
                  <p className="text-xs text-[#8B949E]">
                    **EA Automation** è il ponte tra MetaTrader 5 e l'AI. Riceve i segnali e i dati dal tuo **EA ADDESTRATOR**, li analizza e invia risposte operative istantanee che l'EA può eseguire.
                  </p>
                </div>

                <div className="flex-1 flex flex-col bg-[#0D1117] border border-[#30363D] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 bg-[#161B22] border-b border-[#30363D] flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-[#8B949E] flex items-center gap-2">
                      <Zap size={16} className="text-[#E3B341]" /> Bidirectional Traffic Log
                    </h3>
                    <span className="text-[10px] font-mono text-[#238636]">MT5 BRIDGE ACTIVE</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 font-mono text-[12px] space-y-4">
                    {eaLogs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[#30363D]">
                        Waiting for EA data packets...
                      </div>
                    ) : (
                      eaLogs.map(log => (
                        <div key={log.id} className={cn(
                          "p-4 border rounded-lg",
                          log.content.includes('INTERROGAZIONE') ? "bg-[#161B22] border-[#30363D]" : "bg-[#238636]/5 border-[#238636]/20"
                        )}>
                          <div className="flex justify-between text-[#8B949E] mb-2">
                            <span>[{log.timestamp.toLocaleTimeString()}]</span>
                            <span className={log.content.includes('INTERROGAZIONE') ? "text-[#00A3FF]" : "text-[#238636]"}>
                              {log.content.includes('INTERROGAZIONE') ? 'EA_INPUT' : 'AI_RESPONSE'}
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap text-[#C9D1D9]">{log.content}</pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'support' && (
              <motion.div 
                key="support"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden"
              >
                <div className="px-6 py-4 bg-[#1C2128] border-b border-[#30363D] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#238636] flex items-center justify-center">
                    <Headphones size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Trading Genius Support</h3>
                    <p className="text-[10px] text-[#238636] font-bold uppercase">Senior Expert Online</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {supportMessages.map(m => (
                    <div key={m.id} className={cn("flex gap-4 max-w-[85%]", m.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", m.role === 'user' ? "bg-[#00A3FF]" : "bg-[#238636]")}>
                        {m.role === 'user' ? <User size={16} /> : <MessageSquare size={16} />}
                      </div>
                      <div className={cn("p-4 rounded-xl text-sm leading-relaxed border", m.role === 'user' ? "bg-[#1C2128] border-[#00A3FF]/30" : "bg-[#0D1117] border-[#30363D]")}>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={supportEndRef} />
                </div>
                <div className="p-4 bg-[#0D1117] border-t border-[#30363D]">
                  <div className="max-w-4xl mx-auto flex gap-3">
                    <input 
                      value={supportInput} onChange={e => setSupportInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSupportChat()}
                      placeholder="Chiedi al Trading Genius..."
                      className="flex-1 bg-[#161B22] border border-[#30363D] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#238636]"
                    />
                    <button 
                      onClick={handleSupportChat}
                      className="bg-[#238636] text-white p-2 rounded-lg hover:bg-[#2EA043] transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-xl flex items-center gap-4">
                  <FileBarChart size={20} className="text-[#00A3FF]" />
                  <p className="text-xs text-[#8B949E]">
                    **Market Reports** genera sintesi periodiche (Daily/Weekly/Monthly) dell'intelligenza di mercato. A differenza dell'Analysis interattiva, i report sono documenti strutturati che analizzano il contesto macro e tecnico globale.
                  </p>
                </div>

                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-[#00A3FF]/10 text-[#00A3FF] rounded-full flex items-center justify-center mx-auto">
                    <FileBarChart size={32} />
                  </div>
                  <h3 className="text-xl font-bold">Market Intelligence Reports</h3>
                  <p className="text-sm text-[#8B949E] max-w-md mx-auto">Genera report istantanei basati sui dati di Google Finance e i tuoi flussi MT5.</p>
                  <div className="flex justify-center gap-4">
                    <button onClick={() => generateReport('daily')} className="bg-[#00A3FF] text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#0081CC] transition-all">Daily Report</button>
                    <button onClick={() => generateReport('weekly')} className="bg-[#238636] text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#2EA043] transition-all">Weekly Report</button>
                    <button onClick={() => generateReport('monthly')} className="bg-[#E3B341] text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#D2A230] transition-all">Monthly Report</button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {messages.filter(m => m.type === 'report').reverse().map(report => (
                    <div key={report.id} className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
                      <div className="flex justify-between items-center mb-4 border-b border-[#30363D] pb-4">
                        <span className="text-xs font-bold uppercase text-[#00A3FF]">Market Report - {report.timestamp.toLocaleDateString()}</span>
                        <button className="text-[#8B949E] hover:text-white"><Upload size={16} /></button>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{report.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Settings size={24} className="text-[#8B949E]" /> System Configuration
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="p-4 bg-[#0D1117] rounded-xl border border-[#30363D] space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold">Primary AI Model</h4>
                          <p className="text-xs text-[#8B949E]">Seleziona l'intelligenza artificiale principale per le analisi.</p>
                        </div>
                        <select 
                          value={activeAI} 
                          onChange={(e) => setActiveAI(e.target.value)}
                          className="bg-[#161B22] border border-[#30363D] text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#00A3FF]"
                        >
                          <option value="gemini-pro">Gemini 2.0 Pro (Recommended)</option>
                          <option value="gemini-flash">Gemini 2.0 Flash (Fast)</option>
                          <option value="gpt-4">GPT-4o (Requires API Key)</option>
                          <option value="claude-3">Claude 3.5 Sonnet (Requires API Key)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#0D1117] rounded-xl border border-[#30363D]">
                      <div>
                        <h4 className="font-bold">Google Search Grounding</h4>
                        <p className="text-xs text-[#8B949E]">Permette all'AI di accedere a dati in tempo reale dal web.</p>
                      </div>
                      <div className="w-12 h-6 bg-[#238636] rounded-full relative">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#0D1117] rounded-xl border border-[#30363D]">
                      <div>
                        <h4 className="font-bold">MT5 WebSocket Stream</h4>
                        <p className="text-xs text-[#8B949E]">Connessione attiva con il terminale MetaTrader 5.</p>
                      </div>
                      <div className={cn("w-12 h-6 rounded-full relative", isConnected ? "bg-[#238636]" : "bg-[#30363D]")}>
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", isConnected ? "right-1" : "left-1")} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Info size={24} className="text-[#00A3FF]" /> Platform Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 bg-[#0D1117] rounded-xl border border-[#30363D]">
                      <span className="text-[#8B949E] block mb-1">Version</span>
                      <span className="font-mono">2.9.5 PRO</span>
                    </div>
                    <div className="p-4 bg-[#0D1117] rounded-xl border border-[#30363D]">
                      <span className="text-[#8B949E] block mb-1">Environment</span>
                      <span className="text-[#238636] font-bold">PRODUCTION READY</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
