import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import type {
  Mt5BridgeStatus,
  Mt5MarketOverviewRow,
  Mt5Notification,
  Mt5RealtimeLog,
} from '../mt5/types';

type Mt5StatusResponse = {
  bridge: Mt5BridgeStatus;
};

const DEFAULT_STATUS: Mt5BridgeStatus = {
  active: false,
  connected: false,
  last_packet_at: null,
  last_source: null,
  watched_dirs: [],
};

export function useMt5Bridge() {
  const [bridgeStatus, setBridgeStatus] = useState<Mt5BridgeStatus>(DEFAULT_STATUS);
  const [marketRows, setMarketRows] = useState<Mt5MarketOverviewRow[]>([]);
  const [logs, setLogs] = useState<Mt5RealtimeLog[]>([]);
  const [notifications, setNotifications] = useState<Mt5Notification[]>([]);

  useEffect(() => {
    const socket = io();

    socket.on('mt5:bridge_status', (payload: Mt5BridgeStatus) => {
      setBridgeStatus(payload);
    });

    socket.on('mt5:market_overview', (payload: Mt5MarketOverviewRow[]) => {
      setMarketRows(payload);
    });

    socket.on('mt5:packet', (payload: Mt5RealtimeLog) => {
      setLogs((previous) => [payload, ...previous].slice(0, 120));
    });

    socket.on('mt5:notification', (payload: Mt5Notification) => {
      setNotifications((previous) => [payload, ...previous].slice(0, 40));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [statusResponse, overviewResponse, logsResponse] = await Promise.all([
          fetch('/api/mt5/status'),
          fetch('/api/mt5/overview'),
          fetch('/api/mt5/logs?limit=80'),
        ]);

        if (statusResponse.ok) {
          const data: Mt5StatusResponse = await statusResponse.json();
          if (data.bridge) setBridgeStatus(data.bridge);
        }

        if (overviewResponse.ok) {
          const data = await overviewResponse.json();
          setMarketRows(Array.isArray(data.rows) ? data.rows : []);
        }

        if (logsResponse.ok) {
          const data = await logsResponse.json();
          setLogs(Array.isArray(data.logs) ? data.logs : []);
        }
      } catch (error) {
        console.error('Failed to bootstrap MT5 bridge data:', error);
      }
    };

    bootstrap();
  }, []);

  const controls = useMemo(
    () => ({
      async startBridge() {
        await fetch('/api/mt5/bridge/start', { method: 'POST' });
      },
      async stopBridge() {
        await fetch('/api/mt5/bridge/stop', { method: 'POST' });
      },
      dismissNotification(id: string) {
        setNotifications((previous) => previous.filter((entry) => entry.id !== id));
      },
    }),
    [],
  );

  return {
    bridgeStatus,
    marketRows,
    logs,
    notifications,
    ...controls,
  };
}
