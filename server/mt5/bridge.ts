import fs from "fs";
import path from "path";
import crypto from "crypto";
import type express from "express";
import type { Server as SocketServer } from "socket.io";

type LimitWindow = "none" | "daily" | "monthly";

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
  source: "webhook" | "file";
  filename?: string;
  symbol?: string;
  received_at: string;
  payload: Record<string, unknown>;
}

type BridgeStatus = {
  active: boolean;
  connected: boolean;
  last_packet_at: string | null;
  last_source: "webhook" | "file" | null;
  watched_dirs: string[];
};

type InitMt5BridgeDeps = {
  app: express.Express;
  io: SocketServer;
  ai: any;
  supabaseAdmin?: any;
};

type ReportTimeframe = "daily" | "weekly" | "monthly";

type ReportFileDescriptor = {
  absolute_path: string;
  relative_path: string;
  filename: string;
  extension: ".csv" | ".json";
  modified_at: string;
  mtime_ms: number;
  size_bytes: number;
};

type ReportDatasetContext = {
  cutoff_at: string;
  files_considered: number;
  csv_files: Array<Record<string, unknown>>;
  json_files: Array<Record<string, unknown>>;
};

const MAX_LOGS = 120;
const POLL_INTERVAL_MS = 6000;
const BRIDGE_EVENT_TYPE = "mt5_bridge";
const ALERT_CONFIDENCE_THRESHOLD = 0.8;
const ALERT_THROTTLE_MS = Math.max(
  30_000,
  Number(process.env.MT5_NOTIFICATION_THROTTLE_MS || 5 * 60 * 1000),
);
const REPORT_MAX_FILES = 18;
const REPORT_MAX_CSV_ROWS = 10;
const REPORT_MAX_JSON_FILES = 12;
const REPORT_SCAN_DEPTH = 2;
const REPORT_MAX_FILE_SIZE_BYTES = 512 * 1024;

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return undefined;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function normalizeConfidence(raw: unknown): number | undefined {
  const value = toNumber(raw);
  if (value === undefined) return undefined;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

function sortOverview(rows: Mt5MarketOverviewRow[]): Mt5MarketOverviewRow[] {
  return rows.sort((a, b) => {
    const aConfidence = a.confidence_score ?? -1;
    const bConfidence = b.confidence_score ?? -1;
    if (aConfidence !== bConfidence) return bConfidence - aConfidence;
    return a.symbol.localeCompare(b.symbol);
  });
}

function normalizeReportTimeframe(value: unknown): ReportTimeframe | null {
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  return null;
}

function getReportLookbackMs(timeframe: ReportTimeframe): number {
  if (timeframe === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (timeframe === "monthly") return 31 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function toRelativeReportPath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function getReportFilePriority(filename: string): number {
  const lower = filename.toLowerCase();
  if (lower === "ranked_opportunities.csv") return 5;
  if (lower === "market_snapshot.csv") return 4;
  if (lower.startsWith("analyzer_")) return 3;
  if (lower.startsWith("last_signal_")) return 2;
  return 1;
}

function summarizeCsvRows(rows: Array<Record<string, string>>): Record<string, unknown> {
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)).filter((key) => key.trim().length > 0)),
  ).slice(0, 16);

  const sampleRows = rows.slice(-REPORT_MAX_CSV_ROWS).map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column] ?? ""])),
  );

  return {
    row_count: rows.length,
    columns,
    sample_rows: sampleRows,
  };
}

function summarizeJsonPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const preferredKeys = [
    "symbol",
    "asset",
    "instrument",
    "timestamp",
    "action",
    "confidence_score",
    "base_confidence",
    "session_quality_label",
    "market_regime",
    "bias_direction",
    "bias_h4",
    "bias_d1",
    "bias_w1",
    "wyckoff_phase",
    "wyckoff_event",
    "liquidity_score",
    "reason",
  ];

  const summary: Record<string, unknown> = {};
  preferredKeys.forEach((key) => {
    const value = payload[key];
    if (value === undefined || value === null || value === "") return;
    if (key === "confidence_score" || key === "base_confidence") {
      summary[key] = normalizeConfidence(value);
      return;
    }
    summary[key] = value;
  });

  if (Object.keys(summary).length > 0) return summary;

  return Object.fromEntries(
    Object.entries(payload)
      .slice(0, 12)
      .map(([key, value]) => [key, typeof value === "string" && value.length > 180 ? `${value.slice(0, 177)}...` : value]),
  );
}

async function collectReportFilesRecursive(
  dir: string,
  depth: number,
  files: ReportFileDescriptor[],
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (depth < REPORT_SCAN_DEPTH) {
        await collectReportFilesRecursive(absolutePath, depth + 1, files);
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (extension !== ".csv" && extension !== ".json") continue;

    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(absolutePath);
    } catch {
      continue;
    }

    files.push({
      absolute_path: absolutePath,
      relative_path: toRelativeReportPath(absolutePath),
      filename: entry.name,
      extension,
      modified_at: stats.mtime.toISOString(),
      mtime_ms: stats.mtimeMs,
      size_bytes: stats.size,
    });
  }
}

export function initMt5Bridge({ app, io, ai, supabaseAdmin }: InitMt5BridgeDeps) {
  const candidateDirs = [
    process.env.MT5_DATA_DIR,
    process.env.MT5_DATA_DIRS,
    path.resolve(process.cwd(), "workspace", "BULL_AI"),
    path.resolve(process.cwd(), "workspace", "SOFTI_DATA"),
    path.resolve(process.cwd(), "BULL_AI"),
    path.resolve(process.cwd(), "SOFTI_DATA"),
  ]
    .flatMap((entry) => (entry ? entry.split(";") : []))
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const watchedDirs = Array.from(new Set(candidateDirs)).filter((dir) => fs.existsSync(dir));

  const analyzerBySymbol = new Map<string, Mt5AnalyzerPayload>();
  const signalBySymbol = new Map<string, Mt5SignalPayload>();
  const marketBySymbol = new Map<string, Mt5MarketOverviewRow>();
  const lastNotificationAtBySymbol = new Map<string, number>();
  const logs: Mt5RealtimeLog[] = [];

  let bridgeActive = true;
  let lastPacketAt: string | null = null;
  let lastSource: "webhook" | "file" | null = null;
  let latestMarketSnapshot: Array<Record<string, string>> = [];
  let latestRankedOpportunities: Array<Record<string, string>> = [];

  const statusPayload = (): BridgeStatus => ({
    active: bridgeActive,
    connected: Boolean(lastPacketAt),
    last_packet_at: lastPacketAt,
    last_source: lastSource,
    watched_dirs: watchedDirs,
  });

  const emitStatus = () => {
    io.emit("mt5:bridge_status", statusPayload());
  };

  const addLog = (entry: Omit<Mt5RealtimeLog, "id">) => {
    const log: Mt5RealtimeLog = { ...entry, id: crypto.randomUUID() };
    logs.unshift(log);
    if (logs.length > MAX_LOGS) logs.splice(MAX_LOGS);
    io.emit("mt5:packet", log);
  };

  const persistArchive = async (
    targetType: string,
    targetId: string,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    if (!supabaseAdmin) return;
    const now = Date.now();
    const expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
    const queryHash = crypto
      .createHash("md5")
      .update(`${targetType}:${targetId}:${JSON.stringify(payload)}`)
      .digest("hex");

    const { error } = await supabaseAdmin
      .from("analysis_archives")
      .insert({
        profile_id: null,
        target_type: targetType,
        target_id: targetId,
        query_hash: queryHash,
        content: JSON.stringify(payload),
        expires_at: expiresAt,
      });

    if (error) {
      console.warn(`[MT5] Unable to archive payload (${targetType}): ${error.message || "unknown error"}`);
    }
  };

  const emitTradingGeniusAlert = (
    symbol: string,
    confidenceScore: number | undefined,
    sessionLabel: string | undefined,
  ) => {
    if (confidenceScore === undefined || confidenceScore < ALERT_CONFIDENCE_THRESHOLD) return;

    const now = Date.now();
    const previousNotificationAt = lastNotificationAtBySymbol.get(symbol) ?? 0;
    if (now - previousNotificationAt < ALERT_THROTTLE_MS) return;

    lastNotificationAtBySymbol.set(symbol, now);

    const roundedConfidence = Math.round(confidenceScore * 100);
    const normalizedSessionLabel = String(sessionLabel || "Alta");

    io.emit("mt5:notification", {
      id: crypto.randomUUID(),
      symbol,
      confidence_score: confidenceScore,
      session_quality_label: normalizedSessionLabel,
      message: `TRADING GENIUS ALERT: Possibile opportunita su ${symbol} (Confidenza: ${roundedConfidence}%)`,
      created_at: new Date(now).toISOString(),
      type: "session_quality_warning",
    });
  };

  const updateOverviewFromAnalyzer = (analyzer: Mt5AnalyzerPayload) => {
    const symbol = analyzer.symbol.toUpperCase();
    const row: Mt5MarketOverviewRow = {
      symbol,
      price: toNumber(analyzer.price),
      market_regime: String(analyzer.market_regime || "Unknown"),
      bias_h4: String(analyzer.bias_h4 || analyzer.bias_direction || "N/A"),
      bias_d1: String(analyzer.bias_d1 || "N/A"),
      bias_w1: String(analyzer.bias_w1 || "N/A"),
      confidence_score: normalizeConfidence(analyzer.confidence_score ?? analyzer.base_confidence),
      wyckoff_phase: analyzer.wyckoff_phase ? String(analyzer.wyckoff_phase) : undefined,
      wyckoff_event: analyzer.wyckoff_event ? String(analyzer.wyckoff_event) : undefined,
      wyckoff_confidence: normalizeConfidence(analyzer.wyckoff_confidence),
      liquidity_score: toNumber(analyzer.liquidity_score),
      liquidity_above: toBoolean(analyzer.liquidity_above),
      liquidity_below: toBoolean(analyzer.liquidity_below),
      liquidity_sweep: toBoolean(analyzer.liquidity_sweep),
      updated_at: new Date().toISOString(),
    };
    marketBySymbol.set(symbol, row);
    io.emit("mt5:market_overview", sortOverview(Array.from(marketBySymbol.values())));
    emitTradingGeniusAlert(symbol, row.confidence_score, String(analyzer.session_quality_label || "Alta"));
  };

  const ingestAnalyzerPayload = async (
    payload: Record<string, unknown>,
    source: "webhook" | "file",
    filename?: string,
  ) => {
    if (!bridgeActive) return;
    const symbol = String(payload.symbol || payload.asset || payload.instrument || "").toUpperCase();
    if (!symbol) return;

    const analyzer: Mt5AnalyzerPayload = {
      ...payload,
      symbol,
      liquidity_above: toBoolean(payload.liquidity_above),
      liquidity_below: toBoolean(payload.liquidity_below),
      liquidity_sweep: toBoolean(payload.liquidity_sweep),
      confidence_score: normalizeConfidence(payload.confidence_score),
      base_confidence: normalizeConfidence(payload.base_confidence),
      timestamp: String(payload.timestamp || new Date().toISOString()),
    };

    analyzerBySymbol.set(symbol, analyzer);
    updateOverviewFromAnalyzer(analyzer);

    lastPacketAt = new Date().toISOString();
    lastSource = source;
    emitStatus();

    addLog({
      source,
      symbol,
      filename,
      received_at: lastPacketAt,
      payload,
    });

    await persistArchive("mt5_analyzer", symbol, payload);
  };

  const ingestSignalPayload = async (
    payload: Record<string, unknown>,
    source: "webhook" | "file",
    filename?: string,
  ) => {
    if (!bridgeActive) return;
    const symbol = String(payload.symbol || payload.asset || payload.instrument || "").toUpperCase();
    if (!symbol) return;

    const signal: Mt5SignalPayload = {
      ...payload,
      symbol,
      confidence_score: normalizeConfidence(payload.confidence_score),
      timestamp: String(payload.timestamp || new Date().toISOString()),
    };

    signalBySymbol.set(symbol, signal);
    lastPacketAt = new Date().toISOString();
    lastSource = source;
    emitStatus();

    addLog({
      source,
      symbol,
      filename,
      received_at: lastPacketAt,
      payload,
    });

    emitTradingGeniusAlert(symbol, signal.confidence_score, String(signal.session_quality_label || "Alta"));
    await persistArchive("mt5_signal", symbol, payload);
  };

  const ingestWebhookPayload = async (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const packet = payload as Record<string, unknown>;
    const packetType = String(packet.type || packet.packet_type || "analyzer").toLowerCase();

    if (packetType.includes("signal")) {
      await ingestSignalPayload(packet, "webhook");
      return;
    }

    await ingestAnalyzerPayload(packet, "webhook");
  };

  const parseJsonFile = async (filePath: string): Promise<Record<string, unknown> | null> => {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const parsed = JSON.parse(content);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  const collectHistoricalReportContext = async (timeframe: ReportTimeframe): Promise<ReportDatasetContext> => {
    const reportFiles: ReportFileDescriptor[] = [];
    await Promise.all(watchedDirs.map((dir) => collectReportFilesRecursive(dir, 0, reportFiles)));

    const cutoffMs = Date.now() - getReportLookbackMs(timeframe);
    let selectedFiles = reportFiles
      .filter((file) => file.mtime_ms >= cutoffMs)
      .sort((a, b) => {
        const priorityDelta = getReportFilePriority(b.filename) - getReportFilePriority(a.filename);
        if (priorityDelta !== 0) return priorityDelta;
        return b.mtime_ms - a.mtime_ms;
      })
      .slice(0, REPORT_MAX_FILES);

    if (selectedFiles.length === 0) {
      selectedFiles = reportFiles
        .sort((a, b) => {
          const priorityDelta = getReportFilePriority(b.filename) - getReportFilePriority(a.filename);
          if (priorityDelta !== 0) return priorityDelta;
          return b.mtime_ms - a.mtime_ms;
        })
        .slice(0, REPORT_MAX_FILES);
    }

    const csv_files: Array<Record<string, unknown>> = [];
    const json_files: Array<Record<string, unknown>> = [];

    for (const file of selectedFiles) {
      if (file.size_bytes > REPORT_MAX_FILE_SIZE_BYTES) {
        if (file.extension === ".csv") {
          csv_files.push({
            file: file.relative_path,
            modified_at: file.modified_at,
            skipped: true,
            reason: `File troppo grande (${file.size_bytes} bytes)`,
          });
        } else if (json_files.length < REPORT_MAX_JSON_FILES) {
          json_files.push({
            file: file.relative_path,
            modified_at: file.modified_at,
            skipped: true,
            reason: `File troppo grande (${file.size_bytes} bytes)`,
          });
        }
        continue;
      }

      if (file.extension === ".csv") {
        try {
          const content = await fs.promises.readFile(file.absolute_path, "utf8");
          const rows = parseCsv(content);
          csv_files.push({
            file: file.relative_path,
            modified_at: file.modified_at,
            ...summarizeCsvRows(rows),
          });
        } catch {
          csv_files.push({
            file: file.relative_path,
            modified_at: file.modified_at,
            row_count: 0,
            parse_error: true,
          });
        }
        continue;
      }

      if (json_files.length >= REPORT_MAX_JSON_FILES) continue;

      const payload = await parseJsonFile(file.absolute_path);
      json_files.push({
        file: file.relative_path,
        modified_at: file.modified_at,
        payload: payload ? summarizeJsonPayload(payload) : { parse_error: true },
      });
    }

    return {
      cutoff_at: new Date(cutoffMs).toISOString(),
      files_considered: selectedFiles.length,
      csv_files,
      json_files,
    };
  };

  const processFile = async (filePath: string) => {
    if (!bridgeActive) return;
    const filename = path.basename(filePath).toLowerCase();
    if (filename.startsWith("analyzer_") && filename.endsWith(".json")) {
      const payload = await parseJsonFile(filePath);
      if (payload) await ingestAnalyzerPayload(payload, "file", path.basename(filePath));
      return;
    }

    if (filename.startsWith("last_signal_") && filename.endsWith(".json")) {
      const payload = await parseJsonFile(filePath);
      if (payload) await ingestSignalPayload(payload, "file", path.basename(filePath));
      return;
    }

    if (filename === "market_snapshot.csv") {
      try {
        const content = await fs.promises.readFile(filePath, "utf8");
        latestMarketSnapshot = parseCsv(content);
      } catch {
        latestMarketSnapshot = [];
      }
      return;
    }

    if (filename === "ranked_opportunities.csv") {
      try {
        const content = await fs.promises.readFile(filePath, "utf8");
        latestRankedOpportunities = parseCsv(content);
      } catch {
        latestRankedOpportunities = [];
      }
    }
  };

  const scanAllWatchedFiles = async () => {
    await Promise.all(
      watchedDirs.map(async (dir) => {
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
          await Promise.all(
            entries
              .filter((entry) => entry.isFile())
              .map((entry) => processFile(path.join(dir, entry.name))),
          );
        } catch {
          // ignore missing directories
        }
      }),
    );
  };

  const watcherDebounce = new Map<string, NodeJS.Timeout>();
  const watchHandles: fs.FSWatcher[] = [];

  watchedDirs.forEach((dir) => {
    try {
      const watcher = fs.watch(dir, (_eventType, filename) => {
        if (!filename) return;
        const absolutePath = path.join(dir, filename);

        const key = absolutePath.toLowerCase();
        const previous = watcherDebounce.get(key);
        if (previous) clearTimeout(previous);

        const timer = setTimeout(() => {
          processFile(absolutePath).catch((error) => {
            console.warn(`[MT5] file processing error: ${String(error)}`);
          });
          watcherDebounce.delete(key);
        }, 250);

        watcherDebounce.set(key, timer);
      });

      watchHandles.push(watcher);
    } catch (error) {
      console.warn(`[MT5] Unable to watch directory ${dir}: ${String(error)}`);
    }
  });

  const pollInterval = setInterval(() => {
    scanAllWatchedFiles().catch((error) => {
      console.warn(`[MT5] polling error: ${String(error)}`);
    });
  }, POLL_INTERVAL_MS);

  scanAllWatchedFiles().catch((error) => {
    console.warn(`[MT5] initial scan error: ${String(error)}`);
  });

  io.on("connection", (socket) => {
    socket.emit("mt5:bridge_status", statusPayload());
    socket.emit("mt5:market_overview", sortOverview(Array.from(marketBySymbol.values())));
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      let payload: unknown = req.body;

      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return res.status(400).json({ error: "Invalid JSON payload" });
        }
      }

      await ingestWebhookPayload(payload);
      res.json({ ok: true, bridge: statusPayload() });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Webhook ingest failed" });
    }
  });

  app.get("/api/mt5/status", (_req, res) => {
    res.json({
      bridge: statusPayload(),
      overview_count: marketBySymbol.size,
      analyzer_count: analyzerBySymbol.size,
      signal_count: signalBySymbol.size,
      logs_count: logs.length,
    });
  });

  app.post("/api/mt5/bridge/start", (_req, res) => {
    bridgeActive = true;
    emitStatus();
    res.json({ ok: true, bridge: statusPayload() });
  });

  app.post("/api/mt5/bridge/stop", (_req, res) => {
    bridgeActive = false;
    emitStatus();
    res.json({ ok: true, bridge: statusPayload() });
  });

  app.get("/api/mt5/overview", (_req, res) => {
    res.json({
      rows: sortOverview(Array.from(marketBySymbol.values())),
      updated_at: new Date().toISOString(),
    });
  });

  app.get("/api/mt5/analyzer/:symbol", (req, res) => {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const analyzer = analyzerBySymbol.get(symbol);
    if (!analyzer) {
      return res.status(404).json({ error: `No analyzer payload for symbol ${symbol}` });
    }

    res.json({ symbol, analyzer, signal: signalBySymbol.get(symbol) || null });
  });

  app.get("/api/mt5/logs", (req, res) => {
    const requestedLimit = Number(req.query.limit || 40);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, MAX_LOGS)) : 40;
    res.json({ logs: logs.slice(0, limit) });
  });

  app.post("/api/mt5/interactive-analysis", async (req, res) => {
    try {
      const symbol = String(req.body?.symbol || "").toUpperCase();
      const question = String(req.body?.question || "").trim();
      if (!symbol || !question) {
        return res.status(400).json({ error: "Missing symbol or question" });
      }

      const analyzer = analyzerBySymbol.get(symbol);
      if (!analyzer) {
        return res.status(404).json({ error: `Analyzer data not found for ${symbol}` });
      }

      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const prompt = [
        "Sei il modulo Interactive Analysis di SOFTI AI.",
        `Analizza il seguente JSON MT5 per il simbolo ${symbol}.`,
        "Rispondi in italiano con spiegazione sintetica ma concreta.",
        "Evidenzia regime di mercato, Wyckoff, liquidita e allineamento multi-timeframe quando presenti.",
        "Se un dato manca, dichiaralo esplicitamente.",
        "",
        `JSON CONTEXT:\n${JSON.stringify(analyzer, null, 2)}`,
        "",
        `DOMANDA UTENTE: ${question}`,
      ].join("\n");

      const response = await ai.models.generateContent({ model, contents: prompt });
      res.json({
        symbol,
        answer: response.text || "Nessuna risposta disponibile.",
        context_timestamp: analyzer.timestamp || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Interactive analysis failed" });
    }
  });

  app.post("/api/mt5/reports/generate", async (req, res) => {
    try {
      const timeframe = normalizeReportTimeframe(String(req.body?.timeframe || "daily").toLowerCase());
      if (!timeframe) {
        return res.status(400).json({ error: "Invalid timeframe" });
      }

      await scanAllWatchedFiles().catch((error) => {
        console.warn(`[MT5] pre-report scan error: ${String(error)}`);
      });

      const snapshotRows = latestMarketSnapshot.slice(0, 120);
      const rankedRows = latestRankedOpportunities.slice(0, 60);
      const analyzerRows = Array.from(analyzerBySymbol.values())
        .sort((a, b) => (normalizeConfidence(b.confidence_score ?? b.base_confidence) ?? -1) - (normalizeConfidence(a.confidence_score ?? a.base_confidence) ?? -1))
        .slice(0, 40);
      const signalRows = Array.from(signalBySymbol.values())
        .sort((a, b) => (normalizeConfidence(b.confidence_score) ?? -1) - (normalizeConfidence(a.confidence_score) ?? -1))
        .slice(0, 40);
      const liveOverview = sortOverview(Array.from(marketBySymbol.values())).slice(0, 24);
      const historicalContext = await collectHistoricalReportContext(timeframe);
      const sourceSummary = {
        market_snapshot: snapshotRows.length,
        ranked_opportunities: rankedRows.length,
        analyzer_stream: analyzerRows.length,
        signal_stream: signalRows.length,
        live_overview: liveOverview.length,
        historical_csv_files: historicalContext.csv_files.length,
        historical_json_files: historicalContext.json_files.length,
      };

      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const prompt = [
        "Sei un Head Trader istituzionale e analista finanziario senior di SOFTI AI.",
        `Genera un Market Report ${timeframe} professionale in italiano usando esclusivamente i dati MT5 forniti.`,
        "Restituisci solo Markdown valido, senza HTML e senza blocchi di codice.",
        "Se i dati sono parziali o mancanti, dichiaralo esplicitamente senza inventare numeri.",
        "Struttura richiesta:",
        "1. Titolo report",
        "2. Executive Summary",
        "3. Contesto Macro e Sentiment",
        "4. Setup e Bias Confermati",
        "5. Wyckoff, Liquidita e Qualita Sessione",
        "6. Asset da Monitorare",
        "7. Rischi e Invalidazioni",
        "8. Conclusione Operativa",
        "",
        `Timeframe richiesto: ${timeframe}`,
        `Bridge status: ${JSON.stringify(statusPayload())}`,
        `Source summary: ${JSON.stringify(sourceSummary)}`,
        "",
        `Live market overview: ${JSON.stringify(liveOverview)}`,
        `Market snapshot CSV: ${JSON.stringify(snapshotRows)}`,
        `Ranked opportunities CSV: ${JSON.stringify(rankedRows)}`,
        `Analyzer stream: ${JSON.stringify(analyzerRows)}`,
        `Signal stream: ${JSON.stringify(signalRows)}`,
        "",
        `Historical CSV context: ${JSON.stringify(historicalContext.csv_files)}`,
        `Historical JSON context: ${JSON.stringify(historicalContext.json_files)}`,
      ].join("\n");

      const response = await ai.models.generateContent({ model, contents: prompt });
      const markdown = response.text || "Report non disponibile.";

      await persistArchive("mt5_report", timeframe, {
        timeframe,
        markdown,
        generated_at: new Date().toISOString(),
        snapshot_size: snapshotRows.length,
        ranked_size: rankedRows.length,
        source_rows: sourceSummary,
        historical_cutoff_at: historicalContext.cutoff_at,
      });

      res.json({
        timeframe,
        markdown,
        generated_at: new Date().toISOString(),
        source_rows: sourceSummary,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Report generation failed" });
    }
  });

  app.get("/api/mt5/reports/latest", async (req, res) => {
    if (!supabaseAdmin) {
      return res.json({ report: null });
    }

    try {
      const timeframe = String(req.query.timeframe || "daily").toLowerCase();
      const query = await supabaseAdmin
        .from("analysis_archives")
        .select("target_id, content, created_at")
        .eq("target_type", "mt5_report")
        .eq("target_id", timeframe)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = query?.data;
      if (!row) return res.json({ report: null });

      let parsedContent: Record<string, unknown> | null = null;
      try {
        parsedContent = JSON.parse(String((row as any).content || "{}"));
      } catch {
        parsedContent = null;
      }

      return res.json({ report: parsedContent });
    } catch {
      return res.json({ report: null });
    }
  });

  console.log(`[MT5] Bridge initialized. Watched directories: ${watchedDirs.length > 0 ? watchedDirs.join(", ") : "none"}`);
}
