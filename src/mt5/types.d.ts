export interface Mt5AnalyzerPayload {
  symbol: string;
  action?: string;
  base_confidence?: number;
  bias_direction?: string;
  trigger_tf?: string;
  bias_strength?: number;
  market_regime?: string;
  liquidity_above?: boolean;
  liquidity_below?: boolean;
  liquidity_sweep?: boolean;
  equal_highs_found?: boolean;
  equal_lows_found?: boolean;
  pdh?: number;
  pdl?: number;
  liquidity_score?: number;
  session_name?: string;
  session_quality_label?: string;
  rr_value?: number;
  rr_score?: number;
  rr_label?: string;
  wyckoff_phase?: string;
  wyckoff_event?: string;
  wyckoff_confidence?: number;
  confidence_score?: number;
  aligned?: boolean;
  selected?: boolean;
  rank?: number;
  reason?: string;
  price?: number;
  bias_h4?: string;
  bias_d1?: string;
  bias_w1?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface Mt5SignalPayload {
  symbol: string;
  action?: string;
  confidence_score?: number;
  session_quality_label?: string;
  reason?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface Mt5MarketOverviewRow {
  symbol: string;
  price?: number;
  market_regime?: string;
  bias_h4?: string;
  bias_d1?: string;
  bias_w1?: string;
  confidence_score?: number;
  wyckoff_phase?: string;
  wyckoff_event?: string;
  wyckoff_confidence?: number;
  liquidity_score?: number;
  liquidity_above?: boolean;
  liquidity_below?: boolean;
  liquidity_sweep?: boolean;
  updated_at: string;
}

export interface Mt5RealtimeLog {
  id: string;
  source: 'webhook' | 'file';
  filename?: string;
  symbol?: string;
  received_at: string;
  payload: Record<string, unknown>;
}

export interface Mt5BridgeStatus {
  active: boolean;
  connected: boolean;
  last_packet_at: string | null;
  last_source: 'webhook' | 'file' | null;
  watched_dirs: string[];
}

export interface Mt5Notification {
  id: string;
  symbol: string;
  confidence_score: number;
  session_quality_label: string;
  message: string;
  created_at: string;
  type: 'session_quality_warning';
}
