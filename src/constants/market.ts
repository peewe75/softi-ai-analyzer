import { Asset, DataFeed } from '../types';

export const ASSET_DATABASE: Asset[] = [
    // FOREX MAJOR
    { id: 'eurusd', symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex', sector: 'Major', price: '...', change: '...', trend: 'neutral' },
    { id: 'gbpusd', symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'Forex', sector: 'Major', price: '...', change: '...', trend: 'neutral' },
    { id: 'usdjpy', symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'Forex', sector: 'Major', price: '...', change: '...', trend: 'neutral' },
    { id: 'audusd', symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', category: 'Forex', sector: 'Major', price: '...', change: '...', trend: 'neutral' },
    { id: 'usdchf', symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', category: 'Forex', sector: 'Major', price: '...', change: '...', trend: 'neutral' },
    { id: 'usdcad', symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', category: 'Forex', sector: 'Major', price: '...', change: '...', trend: 'neutral' },
    { id: 'nzdusd', symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', category: 'Forex', sector: 'Major', price: '...', change: '...', trend: 'neutral' },

    // FOREX MINOR
    { id: 'eurgbp', symbol: 'EURGBP', name: 'Euro / British Pound', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'eurjpy', symbol: 'EURJPY', name: 'Euro / Japanese Yen', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'eurchf', symbol: 'EURCHF', name: 'Euro / Swiss Franc', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'eurcad', symbol: 'EURCAD', name: 'Euro / Canadian Dollar', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'euraud', symbol: 'EURAUD', name: 'Euro / Australian Dollar', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'gbpjpy', symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'gbpchf', symbol: 'GBPCHF', name: 'British Pound / Swiss Franc', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'gbpaud', symbol: 'GBPAUD', name: 'British Pound / Australian Dollar', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'gbpcad', symbol: 'GBPCAD', name: 'British Pound / Canadian Dollar', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'audjpy', symbol: 'AUDJPY', name: 'Australian Dollar / Japanese Yen', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'audcad', symbol: 'AUDCAD', name: 'Australian Dollar / Canadian Dollar', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'audnzd', symbol: 'AUDNZD', name: 'Australian Dollar / New Zealand Dollar', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'cadjpy', symbol: 'CADJPY', name: 'Canadian Dollar / Japanese Yen', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'cadchf', symbol: 'CADCHF', name: 'Canadian Dollar / Swiss Franc', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'chfjpy', symbol: 'CHFJPY', name: 'Swiss Franc / Japanese Yen', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },
    { id: 'nzdjpy', symbol: 'NZDJPY', name: 'New Zealand Dollar / Japanese Yen', category: 'Forex', sector: 'Minor', price: '...', change: '...', trend: 'neutral' },

    // FOREX EXOTIC
    { id: 'usdtry', symbol: 'USDTRY', name: 'US Dollar / Turkish Lira', category: 'Forex', sector: 'Exotic', price: '...', change: '...', trend: 'neutral' },
    { id: 'usdsek', symbol: 'USDSEK', name: 'US Dollar / Swedish Krona', category: 'Forex', sector: 'Exotic', price: '...', change: '...', trend: 'neutral' },
    { id: 'usdnok', symbol: 'USDNOK', name: 'US Dollar / Norwegian Krone', category: 'Forex', sector: 'Exotic', price: '...', change: '...', trend: 'neutral' },
    { id: 'usdmxn', symbol: 'USDMXN', name: 'US Dollar / Mexican Peso', category: 'Forex', sector: 'Exotic', price: '...', change: '...', trend: 'neutral' },
    { id: 'usdzar', symbol: 'USDZAR', name: 'US Dollar / South African Rand', category: 'Forex', sector: 'Exotic', price: '...', change: '...', trend: 'neutral' },

    // COMMODITIES
    { id: 'xauusd', symbol: 'XAUUSD', name: 'Gold Spot', category: 'Commodities', sector: 'Metals', price: '...', change: '...', trend: 'neutral' },
    { id: 'xagusd', symbol: 'XAGUSD', name: 'Silver Spot', category: 'Commodities', sector: 'Metals', price: '...', change: '...', trend: 'neutral' },
    { id: 'copper', symbol: 'HG1!', name: 'Copper Futures', category: 'Commodities', sector: 'Metals', price: '...', change: '...', trend: 'neutral' },
    { id: 'wti', symbol: 'CL1!', name: 'WTI Crude Oil', category: 'Commodities', sector: 'Energy', price: '...', change: '...', trend: 'neutral' },
    { id: 'brent', symbol: 'CB1!', name: 'Brent Crude Oil', category: 'Commodities', sector: 'Energy', price: '...', change: '...', trend: 'neutral' },
    { id: 'ng', symbol: 'NG1!', name: 'Natural Gas', category: 'Commodities', sector: 'Energy', price: '...', change: '...', trend: 'neutral' },
    { id: 'wheat', symbol: 'ZW1!', name: 'Wheat', category: 'Commodities', sector: 'Agriculture', price: '...', change: '...', trend: 'neutral' },
    { id: 'corn', symbol: 'ZC1!', name: 'Corn', category: 'Commodities', sector: 'Agriculture', price: '...', change: '...', trend: 'neutral' },
    { id: 'soybean', symbol: 'ZS1!', name: 'Soybeans', category: 'Commodities', sector: 'Agriculture', price: '...', change: '...', trend: 'neutral' },

    // CRYPTO
    { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },
    { id: 'eth', symbol: 'ETHUSD', name: 'Ethereum', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },
    { id: 'sol', symbol: 'SOLUSD', name: 'Solana', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },
    { id: 'xrp', symbol: 'XRPUSD', name: 'Ripple', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },
    { id: 'ada', symbol: 'ADAUSD', name: 'Cardano', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },
    { id: 'dot', symbol: 'DOTUSD', name: 'Polkadot', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },
    { id: 'bnb', symbol: 'BNBUSD', name: 'Binance Coin', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },
    { id: 'link', symbol: 'LINKUSD', name: 'Chainlink', category: 'Crypto', sector: 'Digital Assets', price: '...', change: '...', trend: 'neutral' },

    // INDICES
    { id: 'es', symbol: 'ES1!', name: 'S&P 500 Futures', category: 'Indices', sector: 'US Market', price: '...', change: '...', trend: 'neutral' },
    { id: 'nq', symbol: 'NQ1!', name: 'Nasdaq 100 Futures', category: 'Indices', sector: 'US Market', price: '...', change: '...', trend: 'neutral' },
    { id: 'ym', symbol: 'YM1!', name: 'Dow Jones Futures', category: 'Indices', sector: 'US Market', price: '...', change: '...', trend: 'neutral' },
    { id: 'dax', symbol: 'DAX', name: 'Germany 40', category: 'Indices', sector: 'EU Market', price: '...', change: '...', trend: 'neutral' },
    { id: 'ftsemib', symbol: 'FTSEMIB', name: 'Italy 40 (MIB)', category: 'Indices', sector: 'EU Market', price: '...', change: '...', trend: 'neutral' },
    { id: 'uk100', symbol: 'UK100', name: 'FTSE 100', category: 'Indices', sector: 'EU Market', price: '...', change: '...', trend: 'neutral' },
    { id: 'cac40', symbol: 'FCE1!', name: 'CAC 40', category: 'Indices', sector: 'EU Market', price: '...', change: '...', trend: 'neutral' },
    { id: 'n225', symbol: 'NIY1!', name: 'Nikkei 225', category: 'Indices', sector: 'Asian Market', price: '...', change: '...', trend: 'neutral' },

    // BONDS
    { id: 'us10y', symbol: 'US10Y', name: 'US 10Y Yield', category: 'Bonds', sector: 'Government', price: '...', change: '...', trend: 'neutral' },
    { id: 'de10y', symbol: 'DE10Y', name: 'Bund 10Y Yield', category: 'Bonds', sector: 'Government', price: '...', change: '...', trend: 'neutral' },
    { id: 'it10y', symbol: 'IT10Y', name: 'BTP 10Y Yield', category: 'Bonds', sector: 'Government', price: '...', change: '...', trend: 'neutral' },

    // INSURANCE
    { id: 'alv', symbol: 'ALV.DE', name: 'Allianz SE', category: 'Insurance', sector: 'Finance', price: '...', change: '...', trend: 'neutral' },
    { id: 'axa', symbol: 'CS.PA', name: 'AXA SA', category: 'Insurance', sector: 'Finance', price: '...', change: '...', trend: 'neutral' },
    { id: 'aig', symbol: 'AIG', name: 'American International Group', category: 'Insurance', sector: 'Finance', price: '...', change: '...', trend: 'neutral' },
];

export const DATA_FEEDS: DataFeed[] = [
    { id: 'news-events', name: 'News & Events', provider: 'RSS Wire', type: 'free', status: 'active', description: 'Live macro headlines and sentiment pulse from financial RSS feeds.' },
    { id: 'google', name: 'Google Finance', provider: 'Google', type: 'free', status: 'active', description: 'Real-time market data via AI Grounding.' },
    { id: 'yahoo', name: 'Yahoo Finance', provider: 'Yahoo', type: 'free', status: 'active', description: 'Historical and fundamental data feed.' },
    { id: 'alphavantage', name: 'Alpha Vantage', provider: 'AV', type: 'paid', status: 'active', description: 'Premium API for global stocks and FX.' },
    { id: 'finnhub', name: 'Finnhub', provider: 'Finnhub', type: 'paid', status: 'active', description: 'Real-time stock, FX and crypto data.' },
    { id: 'eulerpool', name: 'Eulerpool', provider: 'Eulerpool', type: 'paid', status: 'inactive', description: 'Institutional grade fundamental data.' },
    { id: 'marketstack', name: 'Marketstack', provider: 'Marketstack', type: 'paid', status: 'inactive', description: 'Global stock market data API.' },
    { id: 'marketaux', name: 'Marketaux', provider: 'Marketaux', type: 'free', status: 'active', description: 'Financial news and sentiment analysis.' },
];
