export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isAnalysis?: boolean;
    type?: 'chat' | 'support' | 'ea_auto' | 'report';
}

export interface Asset {
    id: string;
    symbol: string;
    name: string;
    category: string;
    sector: string;
    price?: string;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
}

export interface DataFeed {
    id: string;
    name: string;
    provider: string;
    type: 'free' | 'paid';
    status: 'active' | 'inactive';
    description: string;
    url?: string;
}

export type Tab = 'overview' | 'analysis' | 'feeds' | 'automation' | 'reports' | 'support' | 'settings';
