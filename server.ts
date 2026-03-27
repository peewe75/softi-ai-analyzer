import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { clerkClient, decodeJwt, verifyToken } from '@clerk/clerk-sdk-node';
import { supabaseAdmin } from './lib/supabase';
import { syncClerkUser } from './lib/clerk-sync.js';
import { resolveEffectiveEntitlements } from './lib/entitlements.js';
import { createBillingRouter } from './server/routes/billing.js';
import { createFeedsRouter } from './server/routes/feeds.js';
import crypto from 'crypto';
import { initMt5Bridge } from './server/mt5/bridge.js';
import { normalizeActiveFeeds, resolveMarketData } from './server/services/market-data.js';

type ProfileRole = 'owner' | 'admin' | 'user';
type CanonicalRole = 'admin' | 'user';
type PlanApplyScope = 'all_active_and_new' | 'new_only';
type LimitWindow = 'none' | 'daily' | 'monthly';

type EffectiveLimit = {
  limit_key: string;
  limit_value: number | null;
  window: LimitWindow;
};

type AuthenticatedRequest = express.Request & {
  auth?: {
    userId?: string | null;
    sessionId?: string | null;
    sessionClaims?: unknown;
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const renderOriginPattern = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.onrender\.com$/i;
const spaRoutePattern = /^\/(?!api(?:\/|$)).*/;
const missingSupabaseCodes = new Set(['PGRST205', '42P01', '42703']);

const isAllowedCorsOrigin = (origin?: string | null) => {
  if (!origin) return true;
  if (origin === 'https://ultrabot.space') return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  return renderOriginPattern.test(origin);
};

const isMissingSupabaseResource = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  if (error.code && missingSupabaseCodes.has(error.code)) return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('could not find the table') || message.includes('column') && message.includes('schema cache');
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedCorsOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin not allowed"));
      },
      credentials: true,
    },
  });

  const PORT = Number(process.env.PORT) || 3000;
  const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  console.log("\n--- [STARTUP] SOFTI AI ANALYZER ---");
  console.log("NODE_ENV:", process.env.NODE_ENV || "development");
  console.log("PORTA:", PORT);
  console.log("CHIAVE CLERK:", clerkSecretKey ? `PRESENTE (${clerkSecretKey.substring(0, 10)}...)` : "!!! MANCANTE !!!");
  console.log("-----------------------------------\n");

  const ai = new GoogleGenAI({ apiKey: geminiApiKey || "" });

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isAllowedCorsOrigin(origin)) {
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
      }
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json());
  app.use(express.text());

  initMt5Bridge({ app, io, ai, supabaseAdmin });

  // Middleware Clerk Core — custom implementation to support clockSkewInMs
  // (ClerkExpressWithAuth v4 silently drops this option internally)
  const CLOCK_SKEW_MS = 5 * 60 * 1000; // 5-minute tolerance for Windows VPS clock drift

  const clerkMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    (req as any).auth = { userId: null, sessionId: null, sessionClaims: null };
    if (!token) return next();
    try {
      const claims = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        jwtKey: process.env.CLERK_JWT_KEY,
        clockSkewInMs: CLOCK_SKEW_MS,
        issuer: (iss: string) =>
          iss.startsWith('https://clerk.') || iss.includes('.clerk.accounts'),
      });
      (req as any).auth = { userId: claims.sub, sessionId: claims.sid, sessionClaims: claims };
    } catch (err: any) {
      console.error(
        `[CLERK AUTH FAILURE] ${new Date().toISOString()} ` +
        `| reason=${err?.reason ?? err?.message ?? 'unknown'} ` +
        `| token_prefix=${token.substring(0, 20)}...`
      );
    }
    next();
  };

  const getClerkIdentity = async (userId: string) => {
    const user = await clerkClient.users.getUser(userId);
    const email = (user.emailAddresses[0]?.emailAddress || '').trim().toLowerCase();
    return {
      email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: normalizeRole((user.publicMetadata as any)?.role) || 'user',
    };
  };

  const findProfileByAuthUserId = async (userId: string) => {
    const identity = await getClerkIdentity(userId);
    if (!identity.email) {
      return { profile: null, identity, error: { status: 400, body: { error: 'Authenticated user is missing an email address' } } };
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', identity.email)
      .maybeSingle();

    if (error) {
      return { profile: null, identity, error: { status: 500, body: { error: error.message } } };
    }

    if (!profile) {
      return { profile: null, identity, error: { status: 404, body: { error: 'Profile not found' } } };
    }

    return { profile, identity, error: null };
  };

  const getRequesterProfile = async (req: AuthenticatedRequest) => {
    const userId = req.auth?.userId;
    if (!userId) {
      return { profile: null, error: { status: 401, body: { error: 'Unauthorized' } } };
    }

    const { profile, error } = await findProfileByAuthUserId(userId);
    if (error || !profile) {
      return { profile: null, error: error || { status: 403, body: { error: 'Forbidden' } } };
    }

    return { profile, error: null };
  };

  const requireAdminOrOwner = async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const { profile, error } = await getRequesterProfile(req);
      if (error) {
        res.status(error.status).json(error.body);
        return;
      }

      if (profile.role !== 'admin' && profile.role !== 'owner') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      (req as any).requesterProfile = profile;
      next();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  const writeAuditLog = async (_adminId: string, _action: string, _targetId: string, _details: Record<string, unknown>) => {
    // Audit logging via billing_events is managed centrally in BCS; local writes skipped.
  };

  const normalizeRole = (input: unknown): CanonicalRole | null => {
    const value = String(input || '').toLowerCase();
    if (value === 'admin' || value === 'owner') return 'admin';
    if (value === 'user') return 'user';
    return null;
  };

  const syncRoleToClerk = async (clerkUserId: string | null, role: CanonicalRole) => {
    if (!clerkUserId) {
      return { status: 'skipped' as const, error: null as string | null };
    }

    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const currentPublicMetadata = (clerkUser.publicMetadata || {}) as Record<string, unknown>;

      await clerkClient.users.updateUser(clerkUserId, {
        publicMetadata: {
          ...currentPublicMetadata,
          role,
        },
      });

      return { status: 'ok' as const, error: null as string | null };
    } catch (error: any) {
      const message = error?.errors?.[0]?.message || error?.message || 'Unknown Clerk sync error';
      console.error(`[CLERK ROLE SYNC ERROR] clerk_user_id=${clerkUserId} role=${role} error=${message}`);
      return { status: 'failed' as const, error: message };
    }
  };

  const isValidPlanApplyScope = (value: unknown): value is PlanApplyScope => {
    return value === 'all_active_and_new' || value === 'new_only';
  };

  const VALID_LIMIT_KEYS = ['advanced_analysis_max_requests', 'max_assets_per_analysis'];

  const normalizeLimitWindow = (value: unknown): LimitWindow => {
    if (value === 'daily' || value === 'monthly' || value === 'none') return value;
    return 'none';
  };

  const getActivePlanIdForProfile = async (profileId: string) => {
    const { data: grant, error: grantError } = await supabaseAdmin
      .from('user_apps')
      .select('plan, expires_at')
      .eq('user_id', profileId)
      .eq('app_id', 'softi')
      .maybeSingle();

    if (isMissingSupabaseResource(grantError)) {
      return null;
    }

    if (!grant) return 'free';

    // If expired, fall back to free
    if (grant.expires_at && new Date(grant.expires_at) < new Date()) {
      return 'free';
    }

    return (grant.plan as string) || 'free';
  };

  const resolveEffectiveLimits = async (profileId: string, planId: string | null): Promise<Record<string, EffectiveLimit>> => {
    const result = new Map<string, EffectiveLimit>();

    const effectivePlan = planId || 'free';
    const { data: planRow, error: planLimitsError } = await supabaseAdmin
      .from('app_billing_plans')
      .select('limits')
      .eq('app_id', 'softi')
      .eq('plan_code', effectivePlan)
      .maybeSingle();

    if (isMissingSupabaseResource(planLimitsError)) {
      return {};
    }

    if (!planLimitsError && planRow?.limits) {
      for (const [key, val] of Object.entries(planRow.limits as Record<string, unknown>)) {
        if (!key) continue;
        result.set(key, {
          limit_key: key,
          limit_value: typeof val === 'number' ? val : val === null ? null : Number(val),
          window: 'daily',
        });
      }
    }

    const { data: overrides, error: overridesError } = await supabaseAdmin
      .from('user_limit_overrides')
      .select('limit_key, limit_value, window, enabled')
      .eq('profile_id', profileId);

    if (isMissingSupabaseResource(overridesError)) {
      return Object.fromEntries(result.entries());
    }

    if (!overridesError && overrides) {
      for (const row of overrides as any[]) {
        const key = String(row.limit_key || '');
        if (!key) continue;

        if (row.enabled === false) {
          result.delete(key);
          continue;
        }

        result.set(key, {
          limit_key: key,
          limit_value: typeof row.limit_value === 'number' ? row.limit_value : row.limit_value === null ? null : Number(row.limit_value),
          window: normalizeLimitWindow(row.window),
        });
      }
    }

    return Object.fromEntries(result.entries());
  };

  const getCurrentUsageWindow = (window: LimitWindow) => {
    const now = new Date();
    if (window === 'none') {
      return {
        start: new Date('1970-01-01T00:00:00.000Z'),
        end: new Date('9999-12-31T23:59:59.999Z'),
      };
    }

    if (window === 'daily') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      return { start, end };
    }

    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  };

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // --- DEBUG: Clock Skew Diagnostic (no auth required) ---
  app.get('/api/debug/clock', (req, res) => {
    const serverNow = new Date();
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : null;
    if (!token) {
      return res.json({ serverUtc: serverNow.toISOString(), error: 'Supply: Authorization: Bearer <token>' });
    }
    try {
      const { payload } = decodeJwt(token);
      const nowMs = serverNow.getTime();
      const iatMs = payload.iat ? payload.iat * 1000 : null;
      const expMs = payload.exp ? payload.exp * 1000 : null;
      const nbfMs = payload.nbf ? payload.nbf * 1000 : null;
      return res.json({
        serverUtc: serverNow.toISOString(),
        token: {
          iat: iatMs ? new Date(iatMs).toISOString() : null,
          exp: expMs ? new Date(expMs).toISOString() : null,
          nbf: nbfMs ? new Date(nbfMs).toISOString() : null,
          sub: payload.sub,
          iss: payload.iss,
        },
        diagnosis: {
          clockDriftMs: iatMs !== null ? nowMs - iatMs : null,
          clockDriftSeconds: iatMs !== null ? Math.round((nowMs - iatMs) / 1000) : null,
          isExpiredStrict: expMs !== null ? nowMs > expMs : null,
          isExpiredWith5minTolerance: expMs !== null ? nowMs > expMs + CLOCK_SKEW_MS : null,
          isNotYetActive: nbfMs !== null ? nowMs < nbfMs : null,
          toleranceAppliedMs: CLOCK_SKEW_MS,
        },
      });
    } catch (e: any) {
      return res.status(400).json({ error: 'Failed to decode JWT', detail: e.message });
    }
  });

  // --- API SYNC ---
  app.post("/api/auth/sync", clerkMiddleware, async (req, res) => {
    const userId = (req as any).auth.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const identity = await getClerkIdentity(userId);
      const email = identity.email || req.body?.email || "";
      const firstName = identity.firstName || req.body?.firstName || "Utente";
      const lastName = identity.lastName || req.body?.lastName || "";
      const profile = await syncClerkUser(userId, email, firstName, lastName, identity.role);
      res.json({ success: true, profile });
    } catch (error: any) {
      console.error('[SYNC ERROR]:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // --- API ME ---
  app.get('/api/me', clerkMiddleware, async (req, res) => {
    const userId = (req as any).auth.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { profile, error } = await findProfileByAuthUserId(userId);
      if (error || !profile) {
        return res.status(error?.status || 404).json(error?.body || { error: 'Profile not found' });
      }
      res.json({ clerkUserId: userId, profile });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/me/entitlements', clerkMiddleware, async (req, res) => {
    const userId = (req as any).auth.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { profile, error } = await findProfileByAuthUserId(userId);
      if (error || !profile) return res.status(error?.status || 404).json(error?.body || { error: 'No profile' });
      const planId = await getActivePlanIdForProfile(profile.id);
      const entitlements = await resolveEffectiveEntitlements(profile.id, planId);
      res.json({ entitlements });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/me/limits', clerkMiddleware, async (req, res) => {
    const userId = (req as any).auth.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { profile, error } = await findProfileByAuthUserId(userId);
      if (error || !profile) return res.status(error?.status || 404).json(error?.body || { error: 'No profile' });

      const planId = await getActivePlanIdForProfile(profile.id);
      const limits = await resolveEffectiveLimits(profile.id, planId);
      res.json({ limits });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/me/usage', clerkMiddleware, async (req, res) => {
    const userId = (req as any).auth.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { profile, error: profileError } = await findProfileByAuthUserId(userId);
      if (profileError || !profile) return res.status(profileError?.status || 404).json(profileError?.body || { error: 'No profile' });

      const { data, error } = await supabaseAdmin
        .from('usage_counters')
        .select('metric_key, used_count, window_start, window_end')
        .eq('profile_id', profile.id)
        .order('window_start', { ascending: false })
        .limit(50);

      if (isMissingSupabaseResource(error)) {
        return res.json({ usage: [] });
      }

      if (error) return res.status(500).json({ error: error.message });
      res.json({ usage: data || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/me/usage/consume', clerkMiddleware, async (req, res) => {
    const userId = (req as any).auth.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const metricKey = String(req.body?.metric_key || 'advanced_analysis_requests');
      const amount = Math.max(1, Number(req.body?.amount || 1));
      const assetCount = Math.max(0, Number(req.body?.asset_count || 0));

      const { profile, error: profileError } = await findProfileByAuthUserId(userId);
      if (profileError || !profile) return res.status(profileError?.status || 404).json(profileError?.body || { error: 'No profile' });

      const planId = await getActivePlanIdForProfile(profile.id);
      const limits = await resolveEffectiveLimits(profile.id, planId);

      const maxAssetsLimit = limits.max_assets_per_analysis;
      if (maxAssetsLimit && typeof maxAssetsLimit.limit_value === 'number' && assetCount > maxAssetsLimit.limit_value) {
        return res.status(429).json({
          error: 'ASSET_CAP_EXCEEDED',
          message: `Plan limit reached: max ${maxAssetsLimit.limit_value} assets per analysis.`,
        });
      }

      const requestLimit = limits.advanced_analysis_max_requests;
      if (!requestLimit || requestLimit.limit_value === null || requestLimit.limit_value <= 0) {
        return res.json({ success: true, unlimited: true });
      }

      const window = requestLimit.window || 'monthly';
      const { start, end } = getCurrentUsageWindow(window);

      const { data: existingCounter, error: existingCounterError } = await supabaseAdmin
        .from('usage_counters')
        .select('id, used_count')
        .eq('profile_id', profile.id)
        .eq('metric_key', metricKey)
        .eq('window_start', start.toISOString())
        .eq('window_end', end.toISOString())
        .maybeSingle();

      if (isMissingSupabaseResource(existingCounterError)) {
        return res.json({ success: true, unlimited: true });
      }

      if (existingCounterError) return res.status(500).json({ error: existingCounterError.message });

      const current = Number((existingCounter as any)?.used_count || 0);
      const next = current + amount;

      if (next > requestLimit.limit_value) {
        return res.status(429).json({
          error: 'LIMIT_EXCEEDED',
          message: `Plan limit reached: ${requestLimit.limit_value} advanced analysis requests per ${window}.`,
          limit: requestLimit.limit_value,
          used: current,
          requested: amount,
          window,
        });
      }

      if ((existingCounter as any)?.id) {
        const { error: updateError } = await supabaseAdmin
          .from('usage_counters')
          .update({ used_count: next })
          .eq('id', (existingCounter as any).id);
        if (isMissingSupabaseResource(updateError)) {
          return res.json({ success: true, unlimited: true });
        }
        if (updateError) return res.status(500).json({ error: updateError.message });
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('usage_counters')
          .insert({
            profile_id: profile.id,
            metric_key: metricKey,
            used_count: next,
            window_start: start.toISOString(),
            window_end: end.toISOString(),
          });
        if (isMissingSupabaseResource(insertError)) {
          return res.json({ success: true, unlimited: true });
        }
        if (insertError) return res.status(500).json({ error: insertError.message });
      }

      res.json({
        success: true,
        metric_key: metricKey,
        limit: requestLimit.limit_value,
        used: next,
        remaining: Math.max(0, requestLimit.limit_value - next),
        window,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Analysis & Caching Logic
  app.post("/api/ai/analyze", clerkMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { profile, error: profileError } = await getRequesterProfile(req);
      if (profileError) return res.status(profileError.status).json(profileError.body);

      const { type, symbols, prompt, model = "gemini-1.5-pro", activeFeeds } = req.body;

      if (!type || !symbols) {
        return res.status(400).json({ error: 'Missing type or symbols' });
      }

      const normalizedFeeds = normalizeActiveFeeds(activeFeeds);

      // 1. Calculate deterministic query hash
      const hashInput = JSON.stringify({ type, symbols, prompt, model, activeFeeds: normalizedFeeds }).toLowerCase();
      const query_hash = crypto.createHash('md5').update(hashInput).digest('hex');

      // 2. Check for fresh cached result (valid for 6 hours)
      let cached: any = null;
      const { data: cachedResult, error: cacheError } = await supabaseAdmin
        .from('analysis_archives')
        .select('*')
        .eq('query_hash', query_hash)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (isMissingSupabaseResource(cacheError)) {
        console.warn('[AI CACHE] analysis_archives missing, continuing without cache');
      } else if (cacheError) {
        throw cacheError;
      } else {
        cached = cachedResult;
      }

      if (cached) {
        console.log(`[AI CACHE HIT] type=${type} hash=${query_hash}`);
        return res.json({
          content: cached.content,
          cached: true,
          expires_at: cached.expires_at,
          activeFeeds: normalizedFeeds,
        });
      }

      // 3. Cache miss - Call Gemini
      console.log(`[AI CACHE MISS] type=${type} hash=${query_hash} calling Gemini...`);

      let contents = "";
      const serverModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

      if (type === 'market_data') {
        contents = `Cerca in tempo reale il prezzo attuale (con la relativa valuta/formato) e la variazione percentuale (di oggi) per i seguenti asset finanziari: ${symbols}. Restituisci ESCLUSIVAMENTE un JSON valido come array [...] con campi: symbol, price, change, trend (up/down/neutral).`;
      } else if (type === 'report') {
        contents = `${prompt || 'Genera un report'} per i seguenti asset: ${symbols}.`;
      } else {
        contents = `Analisi per ${symbols}: ${prompt}`;
      }

      let resultText = "";
      let providersUsed: string[] = [];
      let warnings: string[] = [];
      try {
        if (type === 'market_data') {
          const resolved = await resolveMarketData({
            ai,
            symbols,
            activeFeeds: normalizedFeeds,
          });
          resultText = JSON.stringify(resolved.rows);
          providersUsed = resolved.providersUsed;
          warnings = resolved.warnings;
        } else {
          const response = await ai.models.generateContent({
            model: serverModel,
            contents,
            config: { tools: [{ googleSearch: {} }] },
          });
          resultText = response.text || "";
        }
      } catch (toolsErr: any) {
        console.warn(`[AI ANALYZE] First attempt failed (${toolsErr?.message}), retrying without tools...`);
        try {
          if (type === 'market_data') {
            const resolved = await resolveMarketData({
              ai,
              symbols,
              activeFeeds: normalizedFeeds.filter((feed) => feed !== 'google'),
            });
            resultText = JSON.stringify(resolved.rows);
            providersUsed = resolved.providersUsed;
            warnings = [`Primary market_data pipeline failed: ${toolsErr?.message || 'unknown error'}`, ...resolved.warnings];
          } else {
            const fallback = await ai.models.generateContent({ model: serverModel, contents });
            resultText = fallback.text || "";
          }
        } catch (fallbackErr) {
          const stableModel = "gemini-2.5-flash";
          if (type === 'market_data') {
            throw fallbackErr;
          } else if (serverModel !== stableModel) {
            console.warn(`[AI ANALYZE] Model "${serverModel}" unavailable, falling back to ${stableModel}...`);
            const lastResort = await ai.models.generateContent({ model: stableModel, contents });
            resultText = lastResort.text || "";
          } else {
            throw fallbackErr;
          }
        }
      }

      // 4. Archive with dynamic duration based on type
      let cacheDurationMs = 6 * 60 * 60 * 1000; // Default: 6 hours

      if (type === 'market_data') {
        cacheDurationMs = 2 * 60 * 1000; // 2 minutes for market prices
      } else if (type === 'analysis') {
        cacheDurationMs = 15 * 60 * 1000; // 15 minutes for deeper analysis
      } else if (type === 'report') {
        cacheDurationMs = 60 * 60 * 1000; // 1 hour for full reports
      }

      const expires_at = new Date(Date.now() + cacheDurationMs).toISOString();
      const { error: insertError } = await supabaseAdmin
        .from('analysis_archives')
        .insert({
          profile_id: profile?.id,
          target_type: type,
          target_id: String(symbols),
          query_hash: query_hash,
          content: resultText,
          expires_at: expires_at
        });

      if (isMissingSupabaseResource(insertError)) {
        console.warn('[AI CACHE] analysis_archives missing, skipping archive insert');
      } else if (insertError) {
        console.error('[AI ARCHIVE INSERT ERROR]', insertError);
      }

      res.json({
        content: resultText,
        cached: false,
        expires_at,
        activeFeeds: normalizedFeeds,
        providersUsed,
        warnings,
      });
    } catch (error: any) {
      console.error('[AI ANALYZE ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin users list
  app.get('/api/admin/users', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .order('created_at', { ascending: false });

      if (profileError) {
        return res.status(500).json({ error: profileError.message });
      }

      // Get user_apps for softi from BCS
      const { data: grants } = await supabaseAdmin
        .from('user_apps')
        .select('user_id, plan, expires_at')
        .eq('app_id', 'softi');

      const grantsByUser = new Map((grants ?? []).map((g: any) => [g.user_id, g]));

      const users = (profiles || []).map((profile: any) => {
        const grant = grantsByUser.get(profile.id);
        return {
          ...profile,
          plan_name: grant?.plan ?? 'free',
          subscription_status: grant ? (grant.expires_at && new Date(grant.expires_at) < new Date() ? 'expired' : 'active') : 'inactive',
        };
      });

      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Super-Analysis (Aggregation)
  app.get('/api/admin/super-analysis', clerkMiddleware, requireAdminOrOwner, async (req: AuthenticatedRequest, res) => {
    try {
      const requester = (req as any).requesterProfile;

      // 1. Fetch all unique analyses from the last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: archives, error: archiveError } = await supabaseAdmin
        .from('analysis_archives')
        .select('*')
        .gt('created_at', yesterday);

      if (archiveError) return res.status(500).json({ error: archiveError.message });

      if (!archives || archives.length === 0) {
        return res.json({ result: "Nessun dato recente (ultime 24h) disponibile nel database per generare la super-analisi." });
      }

      // 2. Prepare context for Gemini - focus on report and analysis types
      const relevantArchives = archives.filter((a: any) => a.target_type !== 'market_data' || archives.length < 20);

      const dataForAggregation = relevantArchives.slice(0, 30).map((a: any) => ({
        subject: a.target_id,
        type: a.target_type,
        timestamp: a.created_at,
        // Ensure we don't send massive blobs if they are huge, but enough for context
        content_preview: a.content.length > 2000 ? a.content.substring(0, 2000) + "..." : a.content
      }));

      const serverModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

      const aggregationPrompt = `Sei un supervisore AI di SOFTI AI. Ti fornisco un set di analisi finanziarie e report generati nelle ultime 24 ore dai nostri utenti. 
      Il tuo compito è creare una "Super Analisi" macroscopica che sintetizzi l'attività recente.
      
      DATI ANALISI (Ultime 24h):
      ${JSON.stringify(dataForAggregation)}
      
      ISTRUZIONI:
      Crea un report di alto livello per l'amministratore che includa:
      1. Sentiment Globale (Bullish/Bearish/Neutral) basato sulla prevalenza delle analisi.
      2. Asset più "caldi": Quali simboli sono stati analizzati più spesso o hanno mostrato segnali forti?
      3. Correlazioni e Macro-Trend: Ci sono temi ricorrenti (es. forza del Dollaro, crollo delle crypto, rotazione settoriale)?
      4. Riassunto Esecutivo: 3-4 punti chiave per chi gestisce la piattaforma.
      
      Rispondi in formato professionale ed elegante (Markdown), in lingua italiana.`;

      // 3. Call Gemini for aggregation
      console.log(`[SUPER-ANALYSIS] Aggregating ${dataForAggregation.length} archives using ${serverModel}...`);

      const response = await ai.models.generateContent({
        model: serverModel,
        contents: aggregationPrompt,
      });

      const resultText = response.text || "La generazione della super-analisi non ha restituito testo.";

      // 4. Log the action (Optional: could store this in a special super_analysis_logs table)
      await writeAuditLog(requester.id, 'admin.super_analysis.generated', 'system', {
        archives_processed: archives.length,
        model_used: serverModel
      });

      res.json({ result: resultText });
    } catch (error: any) {
      console.error('[SUPER ANALYSIS ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  const handleAdminUserRoleUpdate = async (req: express.Request, res: express.Response) => {
    try {
      const requester = (req as any).requesterProfile;
      const userId = req.params.userId;
      const requestedRole = req.body?.role;
      const normalizedRole = normalizeRole(requestedRole);
      if (!normalizedRole) {
        return res.status(422).json({ error: 'Invalid role' });
      }

      const { data: existingProfile, error: existingError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, clerk_user_id')
        .eq('id', userId)
        .single();

      if (existingError || !existingProfile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: normalizedRole, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id, email, first_name, last_name, role, created_at')
        .single();

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      const clerkSync = await syncRoleToClerk(existingProfile.clerk_user_id || null, normalizedRole);

      await writeAuditLog(requester.id, 'admin.user.role.updated', userId, {
        previous_role: existingProfile.role,
        requested_role: requestedRole,
        applied_role: normalizedRole,
        clerk_sync_status: clerkSync.status,
        clerk_error: clerkSync.error,
      });

      res.json({
        success: true,
        user: updatedProfile,
        role: normalizedRole,
        clerk_sync_status: clerkSync.status,
        warning: clerkSync.status === 'failed' ? 'Role updated in Supabase, Clerk sync failed.' : undefined,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.patch('/api/admin/users/:userId/role', clerkMiddleware, requireAdminOrOwner, handleAdminUserRoleUpdate);
  app.post('/api/admin/users/:userId/role', clerkMiddleware, requireAdminOrOwner, handleAdminUserRoleUpdate);

  const handleAdminUserSubscriptionUpdate = async (req: express.Request, res: express.Response) => {
    try {
      const requester = (req as any).requesterProfile;
      const userId = req.params.userId;
      const planName = String(req.body?.plan_name || '').toLowerCase();
      const allowedPlans = ['free', 'lite', 'pro', 'premium', 'monthly'];

      if (!allowedPlans.includes(planName)) {
        return res.status(422).json({ error: 'Invalid plan_name' });
      }

      const { data: userProfile, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (userError || !userProfile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      const { error: upsertError } = await supabaseAdmin
        .from('user_apps')
        .upsert({ user_id: userId, app_id: 'softi', plan: planName, updated_at: new Date().toISOString() }, { onConflict: 'user_id,app_id' });

      if (upsertError) {
        return res.status(500).json({ error: upsertError.message });
      }

      await writeAuditLog(requester.id, 'admin.user.subscription.updated', userId, {
        plan_name: planName,
      });

      res.json({ success: true, plan_name: planName });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.patch('/api/admin/users/:userId/subscription', clerkMiddleware, requireAdminOrOwner, handleAdminUserSubscriptionUpdate);
  app.post('/api/admin/users/:userId/subscription', clerkMiddleware, requireAdminOrOwner, handleAdminUserSubscriptionUpdate);

  app.get('/api/admin/summary', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const [
        { count: totalUsers },
        { data: activeGrants },
      ] = await Promise.all([
        supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('user_apps').select('user_id').eq('app_id', 'softi').eq('plan', 'monthly'),
      ]);
      const active_pro = activeGrants?.length ?? 0;
      const cpuUsage = process.cpuUsage();
      const system_load = Math.round((cpuUsage.user / 1e6) * 10) / 10;
      res.json({ total_users: totalUsers ?? 0, active_pro, system_load, pending_support: 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/audit', clerkMiddleware, requireAdminOrOwner, async (req, res) => {
    try {
      const limitParam = Number(req.query.limit || 20);
      const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 20;

      const { data: logs, error } = await supabaseAdmin
        .from('billing_events')
        .select('id, event_type, payload, processed_at')
        .order('processed_at', { ascending: false })
        .limit(limit);

      if (error) return res.status(500).json({ error: error.message });
      const mapped = (logs || []).map((log: any) => ({
        id: log.id,
        admin_id: 'system',
        action: log.event_type,
        target_id: log.payload?.data?.object?.customer ?? '',
        details: log.payload,
        created_at: log.processed_at,
      }));
      res.json(mapped);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/entitlements', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('entitlements')
        .select('id, name, description, created_at')
        .order('name', { ascending: true });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/plans', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const { data: plans, error: plansError } = await supabaseAdmin
        .from('app_billing_plans')
        .select('plan_code, app_id, billing_type, features, limits, trial_days, is_active')
        .eq('app_id', 'softi')
        .order('plan_code', { ascending: true });

      if (plansError) return res.status(500).json({ error: plansError.message });
      const mapped = (plans || []).map((p: any) => ({
        id: p.plan_code,
        name: p.plan_code === 'free' ? 'Gratuito' : p.plan_code === 'monthly' ? 'Mensile Pro' : p.plan_code,
        description: p.billing_type,
        entitlements: (p.features ?? []).map((f: string) => ({ id: f, name: f })),
      }));
      res.json(mapped);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const handleAdminPlanEntitlementsUpdate = async (req: express.Request, res: express.Response) => {
    try {
      const requester = (req as any).requesterProfile;
      const planId = req.params.planId;
      const entitlementKeys: string[] = Array.isArray(req.body?.entitlement_keys)
        ? (req.body.entitlement_keys as unknown[])
          .map((value: unknown) => String(value).trim().toLowerCase())
          .filter((value): value is string => value.length > 0)
        : [];
      const applyScope = req.body?.apply_scope;

      if (!isValidPlanApplyScope(applyScope)) {
        return res.status(422).json({ error: 'Invalid apply_scope' });
      }

      const uniqueEntitlementKeys = Array.from(new Set(entitlementKeys));

      // Fetch plan from BCS app_billing_plans
      const { data: plan, error: planError } = await supabaseAdmin
        .from('app_billing_plans')
        .select('plan_code')
        .eq('app_id', 'softi')
        .eq('plan_code', planId)
        .maybeSingle();

      if (planError || !plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      // Update features array on app_billing_plans
      const { error: updateError } = await supabaseAdmin
        .from('app_billing_plans')
        .update({ features: uniqueEntitlementKeys })
        .eq('app_id', 'softi')
        .eq('plan_code', planId);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      await writeAuditLog(requester.id, 'admin.plan.entitlements.updated', planId, {
        plan_name: plan.plan_code,
        apply_scope: applyScope,
        new_entitlement_keys: uniqueEntitlementKeys,
      });

      res.json({
        success: true,
        plan_id: planId,
        plan_name: plan.plan_code,
        apply_scope: applyScope,
        entitlement_keys: uniqueEntitlementKeys,
        affected_active_users: 0,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.post('/api/admin/plans/:planId/entitlements', clerkMiddleware, requireAdminOrOwner, handleAdminPlanEntitlementsUpdate);
  app.patch('/api/admin/plans/:planId/entitlements', clerkMiddleware, requireAdminOrOwner, handleAdminPlanEntitlementsUpdate);

  app.get('/api/admin/limits/catalog', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    res.json([
      {
        limit_key: 'advanced_analysis_max_requests',
        label: 'Advanced Analysis Requests',
        description: 'Maximum advanced analysis requests per time window.',
        supported_windows: ['daily', 'monthly', 'none'],
      },
      {
        limit_key: 'max_assets_per_analysis',
        label: 'Max Assets Per Analysis',
        description: 'Maximum number of selected assets/currencies per analysis request.',
        supported_windows: ['none'],
      },
    ]);
  });

  app.get('/api/admin/plans/:planId/limits', clerkMiddleware, requireAdminOrOwner, async (req, res) => {
    try {
      const planId = req.params.planId;
      const { data, error } = await supabaseAdmin
        .from('app_billing_plans')
        .select('limits')
        .eq('app_id', 'softi')
        .eq('plan_code', planId)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      const limits = data?.limits ?? {};
      const result = Object.entries(limits).map(([key, val]: [string, any]) => ({
        plan_id: planId,
        limit_key: key,
        limit_value: typeof val === 'number' ? val : null,
        window: 'daily',
      }));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const handleAdminPlanLimitsUpdate = async (req: express.Request, res: express.Response) => {
    try {
      const requester = (req as any).requesterProfile;
      const planId = req.params.planId;
      const applyScope = req.body?.apply_scope;
      const incomingLimits = Array.isArray(req.body?.limits) ? req.body.limits : [];

      if (!isValidPlanApplyScope(applyScope)) {
        return res.status(422).json({ error: 'Invalid apply_scope' });
      }

      // Fetch plan from BCS app_billing_plans
      const { data: plan, error: planError } = await supabaseAdmin
        .from('app_billing_plans')
        .select('plan_code')
        .eq('app_id', 'softi')
        .eq('plan_code', planId)
        .maybeSingle();

      if (planError || !plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const normalizedLimits: Array<{ plan_id: string; limit_key: string; limit_value: number | null; window: LimitWindow }> = [];
      for (const row of incomingLimits as any[]) {
        const limitKey = String(row?.limit_key || '').trim();
        if (!VALID_LIMIT_KEYS.includes(limitKey)) {
          return res.status(422).json({ error: `Invalid limit_key: ${limitKey}` });
        }

        const rawValue = row?.limit_value;
        let limitValue: number | null = null;
        if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '') {
          const parsed = Number(rawValue);
          if (!Number.isFinite(parsed) || parsed < 0) {
            return res.status(422).json({ error: `Invalid limit_value for ${limitKey}` });
          }
          limitValue = Math.floor(parsed);
        }

        const window = normalizeLimitWindow(row?.window);
        normalizedLimits.push({
          plan_id: planId,
          limit_key: limitKey,
          limit_value: limitValue,
          window,
        });
      }

      // Build JSONB limits object and update app_billing_plans
      const limitsJsonb: Record<string, number | null> = {};
      for (const row of normalizedLimits) {
        limitsJsonb[row.limit_key] = row.limit_value;
      }

      const { error: updateError } = await supabaseAdmin
        .from('app_billing_plans')
        .update({ limits: limitsJsonb })
        .eq('app_id', 'softi')
        .eq('plan_code', planId);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      await writeAuditLog(requester.id, 'admin.plan.limits.updated', planId, {
        plan_name: plan.plan_code,
        apply_scope: applyScope,
        limits: normalizedLimits,
      });

      res.json({
        success: true,
        plan_id: planId,
        plan_name: plan.plan_code,
        apply_scope: applyScope,
        limits: normalizedLimits,
        affected_active_users: 0,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.post('/api/admin/plans/:planId/limits', clerkMiddleware, requireAdminOrOwner, handleAdminPlanLimitsUpdate);
  app.patch('/api/admin/plans/:planId/limits', clerkMiddleware, requireAdminOrOwner, handleAdminPlanLimitsUpdate);

  app.get('/api/admin/payments/prices', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_billing_plans')
        .select('plan_code, billing_type, stripe_price_id, is_active')
        .eq('app_id', 'softi');

      if (error) return res.status(500).json({ error: error.message });
      res.json((data || []).map((p: any) => ({
        id: p.plan_code,
        plan_id: p.plan_code,
        interval: p.billing_type === 'subscription' ? 'month' : 'one_time',
        amount: 0,
        currency: 'eur',
        stripe_price_id: p.stripe_price_id,
        is_active: p.is_active,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/payments/prices/:priceId', clerkMiddleware, requireAdminOrOwner, async (req, res) => {
    try {
      const requester = (req as any).requesterProfile;
      const priceId = req.params.priceId; // priceId == plan_code in BCS
      const isActive = req.body?.is_active !== false;

      const { data, error } = await supabaseAdmin
        .from('app_billing_plans')
        .update({ is_active: isActive })
        .eq('app_id', 'softi')
        .eq('plan_code', priceId)
        .select('plan_code, billing_type, stripe_price_id, is_active')
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      await writeAuditLog(requester.id, 'admin.payments.price.updated', priceId, {
        is_active: isActive,
      });

      res.json({ success: true, price: data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/payments/subscriptions', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('billing_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        return res.status(500).json({
          error: error.message,
          hint: 'Ensure billing_subscriptions table exists before using payments subscriptions area.',
        });
      }

      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/payments/events', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        return res.status(500).json({
          error: error.message,
          hint: 'Ensure payments table exists before using payment events area.',
        });
      }

      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Billing
  app.use('/api/feeds', createFeedsRouter());
  app.use('/api/billing', createBillingRouter(clerkMiddleware));

  // Static Files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    console.log(`[PROD] Servizio da: ${distPath}`);
    app.use(express.static(distPath));
    app.get(spaRoutePattern, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n>>> SOFTI AI ANALYZER OPERATIVO SU PORTA ${PORT} <<<`);
    console.log(`>>> VALIDAZIONE JWT CON CLOCK SKEW TOLERANCE: ${CLOCK_SKEW_MS / 1000}s <<<\n`);
  });
}

startServer().catch(err => {
  console.error("ERRORE FATALE:", err);
});
