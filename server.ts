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

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  const PORT = Number(process.env.PORT) || 3000;
  const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  console.log("\n--- [STARTUP] SOFTI AI ANALYZER ---");
  console.log("NODE_ENV:", process.env.NODE_ENV || "development");
  console.log("PORTA:", PORT);
  console.log("CHIAVE CLERK:", clerkSecretKey ? `PRESENTE (${clerkSecretKey.substring(0, 10)}...)` : "!!! MANCANTE !!!");
  console.log("-----------------------------------\n");

  const ai = new GoogleGenAI({ apiKey: geminiApiKey || "" });

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

  const getRequesterProfile = async (req: AuthenticatedRequest) => {
    const userId = req.auth?.userId;
    if (!userId) {
      return { profile: null, error: { status: 401, body: { error: 'Unauthorized' } } };
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('clerk_user_id', userId)
      .single();

    if (error || !profile) {
      return { profile: null, error: { status: 403, body: { error: 'Forbidden' } } };
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

  const writeAuditLog = async (adminId: string, action: string, targetId: string, details: Record<string, unknown>) => {
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action,
        target_id: targetId,
        details,
      });
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
    const { data: currentSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', profileId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let planId = (currentSubscription as any)?.plan_id || null;
    if (!planId) {
      const { data: freePlan } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('name', 'free')
        .maybeSingle();
      planId = (freePlan as any)?.id || null;
    }
    return planId as string | null;
  };

  const resolveEffectiveLimits = async (profileId: string, planId: string | null): Promise<Record<string, EffectiveLimit>> => {
    const result = new Map<string, EffectiveLimit>();

    if (planId) {
      const { data: planLimits, error: planLimitsError } = await supabaseAdmin
        .from('plan_limits')
        .select('limit_key, limit_value, window')
        .eq('plan_id', planId);

      if (!planLimitsError && planLimits) {
        for (const row of planLimits as any[]) {
          const key = String(row.limit_key || '');
          if (!key) continue;
          result.set(key, {
            limit_key: key,
            limit_value: typeof row.limit_value === 'number' ? row.limit_value : row.limit_value === null ? null : Number(row.limit_value),
            window: normalizeLimitWindow(row.window),
          });
        }
      }
    }

    const { data: overrides, error: overridesError } = await supabaseAdmin
      .from('user_limit_overrides')
      .select('limit_key, limit_value, window, enabled')
      .eq('profile_id', profileId);

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
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses[0]?.emailAddress || req.body?.email || "";
      const firstName = user.firstName || req.body?.firstName || "Utente";
      const metaRole = (user.publicMetadata as any)?.role;

      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('clerk_user_id', userId)
        .maybeSingle();

      const roleForNewUser = normalizeRole(metaRole) || 'user';
      const roleOverride = existingProfile ? undefined : roleForNewUser;

      const profile = await syncClerkUser(userId, email, firstName, "", roleOverride);
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
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('clerk_user_id', userId).single();
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
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
      const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('clerk_user_id', userId).single();
      if (!profile) return res.status(404).json({ error: 'No profile' });
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
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('clerk_user_id', userId)
        .single();

      if (!profile) return res.status(404).json({ error: 'No profile' });

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
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('clerk_user_id', userId)
        .single();

      if (!profile) return res.status(404).json({ error: 'No profile' });

      const { data, error } = await supabaseAdmin
        .from('usage_counters')
        .select('metric_key, used_count, window_start, window_end')
        .eq('profile_id', profile.id)
        .order('window_start', { ascending: false })
        .limit(50);

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

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('clerk_user_id', userId)
        .single();

      if (!profile) return res.status(404).json({ error: 'No profile' });

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

      const { type, symbols, prompt, model = "gemini-1.5-pro" } = req.body;

      if (!type || !symbols) {
        return res.status(400).json({ error: 'Missing type or symbols' });
      }

      // 1. Calculate deterministic query hash
      const hashInput = JSON.stringify({ type, symbols, prompt, model }).toLowerCase();
      const query_hash = crypto.createHash('md5').update(hashInput).digest('hex');

      // 2. Check for fresh cached result (valid for 6 hours)
      const { data: cached, error: cacheError } = await supabaseAdmin
        .from('analysis_archives')
        .select('*')
        .eq('query_hash', query_hash)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        console.log(`[AI CACHE HIT] type=${type} hash=${query_hash}`);
        return res.json({
          content: cached.content,
          cached: true,
          expires_at: cached.expires_at
        });
      }

      // 3. Cache miss - Call Gemini
      console.log(`[AI CACHE MISS] type=${type} hash=${query_hash} calling Gemini...`);

      let contents = "";
      const serverModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";

      if (type === 'market_data') {
        contents = `Cerca in tempo reale il prezzo attuale (con la relativa valuta/formato) e la variazione percentuale (di oggi) per i seguenti asset finanziari: ${symbols}. Restituisci ESCLUSIVAMENTE un JSON valido come array [...] con campi: symbol, price, change, trend (up/down/neutral).`;
      } else if (type === 'report') {
        contents = `${prompt || 'Genera un report'} per i seguenti asset: ${symbols}.`;
      } else {
        contents = `Analisi per ${symbols}: ${prompt}`;
      }

      let resultText = "";
      try {
        const response = await ai.models.generateContent({
          model: serverModel,
          contents,
          config: { tools: [{ googleSearch: {} }] },
        });
        resultText = response.text || "";
      } catch (toolsErr: any) {
        console.warn(`[AI ANALYZE] First attempt failed (${toolsErr?.message}), retrying without tools...`);
        try {
          const fallback = await ai.models.generateContent({ model: serverModel, contents });
          resultText = fallback.text || "";
        } catch (fallbackErr) {
          const stableModel = "gemini-2.0-flash";
          if (serverModel !== stableModel) {
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

      if (insertError) console.error('[AI ARCHIVE INSERT ERROR]', insertError);

      res.json({ content: resultText, cached: false, expires_at });
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
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false });

      if (profileError) {
        return res.status(500).json({ error: profileError.message });
      }

      const profileIds = (profiles || []).map((p: any) => p.id);
      const subscriptionsByUser = new Map<string, { plan_name: string | null; subscription_status: string | null }>();

      if (profileIds.length > 0) {
        const { data: subscriptions, error: subError } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id, status, created_at, plans(name)')
          .in('user_id', profileIds)
          .order('created_at', { ascending: false });

        if (subError) {
          return res.status(500).json({ error: subError.message });
        }

        for (const sub of subscriptions || []) {
          const userId = (sub as any).user_id as string;
          if (subscriptionsByUser.has(userId)) continue;
          subscriptionsByUser.set(userId, {
            plan_name: (sub as any).plans?.name ?? null,
            subscription_status: (sub as any).status ?? null,
          });
        }
      }

      const users = (profiles || []).map((profile: any) => {
        const sub = subscriptionsByUser.get(profile.id);
        return {
          ...profile,
          plan_name: sub?.plan_name ?? 'free',
          subscription_status: sub?.subscription_status ?? 'active',
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

      const serverModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";

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
        .select('id, email, full_name, role, created_at')
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
      const allowedPlans = ['free', 'lite', 'pro', 'premium'];

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

      const { data: targetPlan, error: planError } = await supabaseAdmin
        .from('plans')
        .select('id, name')
        .eq('name', planName)
        .single();

      if (planError || !targetPlan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, plan_id, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentSub?.id) {
        const { error: updateSubError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_id: targetPlan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
          })
          .eq('id', currentSub.id);

        if (updateSubError) {
          return res.status(500).json({ error: updateSubError.message });
        }
      } else {
        const { error: createSubError } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_id: targetPlan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
          });

        if (createSubError) {
          return res.status(500).json({ error: createSubError.message });
        }
      }

      await writeAuditLog(requester.id, 'admin.user.subscription.updated', userId, {
        plan_name: planName,
      });

      res.json({ success: true, user_id: userId, plan_name: planName });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.patch('/api/admin/users/:userId/subscription', clerkMiddleware, requireAdminOrOwner, handleAdminUserSubscriptionUpdate);
  app.post('/api/admin/users/:userId/subscription', clerkMiddleware, requireAdminOrOwner, handleAdminUserSubscriptionUpdate);

  app.get('/api/admin/summary', clerkMiddleware, requireAdminOrOwner, async (_req, res) => {
    try {
      const [{ count: totalUsers, error: totalUsersError }, { data: subscriptions, error: subError }, { count: pendingSupport, error: pendingSupportError }] = await Promise.all([
        supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
        supabaseAdmin
          .from('subscriptions')
          .select('status, plans(name)')
          .eq('status', 'active'),
        supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'support.ticket.pending'),
      ]);

      if (totalUsersError || subError || pendingSupportError) {
        return res.status(500).json({
          error: totalUsersError?.message || subError?.message || pendingSupportError?.message,
        });
      }

      let activePro = 0;
      for (const row of subscriptions || []) {
        const name = (row as any).plans?.name;
        if (name === 'pro' || name === 'premium') {
          activePro += 1;
        }
      }

      const cpuUsage = process.cpuUsage();
      const systemLoad = Number((((cpuUsage.user + cpuUsage.system) / 1000000) % 100).toFixed(1));

      res.json({
        total_users: totalUsers || 0,
        active_pro: activePro,
        system_load: systemLoad,
        pending_support: pendingSupport || 0,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/audit', clerkMiddleware, requireAdminOrOwner, async (req, res) => {
    try {
      const limitParam = Number(req.query.limit || 20);
      const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 20;

      const { data: logs, error } = await supabaseAdmin
        .from('audit_logs')
        .select('id, admin_id, action, target_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(logs || []);
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
        .from('plans')
        .select('id, name, description, created_at')
        .order('name', { ascending: true });

      if (plansError) {
        return res.status(500).json({ error: plansError.message });
      }

      const { data: mappings, error: mappingsError } = await supabaseAdmin
        .from('plan_entitlements')
        .select('plan_id, entitlements(id, name, description)');

      if (mappingsError) {
        return res.status(500).json({ error: mappingsError.message });
      }

      const entitlementsByPlan = new Map<string, Array<{ id: string; name: string; description: string | null }>>();
      for (const row of mappings || []) {
        const planId = (row as any).plan_id as string;
        const entitlement = (row as any).entitlements;
        if (!entitlement || !planId) continue;
        const existing = entitlementsByPlan.get(planId) || [];
        existing.push({
          id: entitlement.id,
          name: entitlement.name,
          description: entitlement.description || null,
        });
        entitlementsByPlan.set(planId, existing);
      }

      const payload = (plans || []).map((plan: any) => ({
        ...plan,
        entitlements: entitlementsByPlan.get(plan.id) || [],
      }));

      res.json(payload);
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

      const { data: plan, error: planError } = await supabaseAdmin
        .from('plans')
        .select('id, name')
        .eq('id', planId)
        .single();

      if (planError || !plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const { data: allEntitlements, error: allEntitlementsError } = await supabaseAdmin
        .from('entitlements')
        .select('id, name');

      if (allEntitlementsError) {
        return res.status(500).json({ error: allEntitlementsError.message });
      }

      const entitlementByKey = new Map<string, { id: string; name: string }>();
      for (const row of allEntitlements || []) {
        entitlementByKey.set((row as any).name, row as any);
      }

      const invalidKeys = uniqueEntitlementKeys.filter((key) => !entitlementByKey.has(key));
      if (invalidKeys.length > 0) {
        return res.status(422).json({ error: 'Invalid entitlement_keys', invalid_keys: invalidKeys });
      }

      const { data: existingMappings, error: existingMappingsError } = await supabaseAdmin
        .from('plan_entitlements')
        .select('entitlements(id, name)')
        .eq('plan_id', planId);

      if (existingMappingsError) {
        return res.status(500).json({ error: existingMappingsError.message });
      }

      const previousEntitlementKeys = Array.from(new Set((existingMappings || [])
        .map((row: any) => row.entitlements?.name)
        .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)));

      let activeSubscribers: Array<{ user_id: string }> = [];
      if (applyScope === 'new_only') {
        const { data: subs, error: subsError } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('plan_id', planId)
          .eq('status', 'active');

        if (subsError) {
          return res.status(500).json({ error: subsError.message });
        }

        activeSubscribers = (subs || []) as Array<{ user_id: string }>;
      }

      const { error: deleteError } = await supabaseAdmin
        .from('plan_entitlements')
        .delete()
        .eq('plan_id', planId);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      if (uniqueEntitlementKeys.length > 0) {
        const rows = uniqueEntitlementKeys.map((key) => ({
          plan_id: planId,
          entitlement_id: entitlementByKey.get(key)!.id,
        }));
        const { error: insertError } = await supabaseAdmin
          .from('plan_entitlements')
          .insert(rows);

        if (insertError) {
          return res.status(500).json({ error: insertError.message });
        }
      }

      let preservedUsers = 0;
      if (applyScope === 'new_only' && activeSubscribers.length > 0) {
        const previousSet = new Set(previousEntitlementKeys);
        const nextSet = new Set(uniqueEntitlementKeys);
        const keepEnabled = Array.from(previousSet).filter((key) => !nextSet.has(key));
        const forceDisabled = Array.from(nextSet).filter((key) => !previousSet.has(key));

        const overrideRows: Array<{ profile_id: string; entitlement_id: string; enabled: boolean }> = [];

        for (const subscription of activeSubscribers) {
          for (const key of keepEnabled) {
            const entitlement = entitlementByKey.get(key);
            if (!entitlement) continue;
            overrideRows.push({
              profile_id: subscription.user_id,
              entitlement_id: entitlement.id,
              enabled: true,
            });
          }

          for (const key of forceDisabled) {
            const entitlement = entitlementByKey.get(key);
            if (!entitlement) continue;
            overrideRows.push({
              profile_id: subscription.user_id,
              entitlement_id: entitlement.id,
              enabled: false,
            });
          }
        }

        if (overrideRows.length > 0) {
          const { error: overrideError } = await supabaseAdmin
            .from('user_entitlement_overrides')
            .upsert(overrideRows, { onConflict: 'profile_id,entitlement_id' });

          if (overrideError) {
            return res.status(500).json({
              error: overrideError.message,
              hint: 'user_entitlement_overrides table or constraints may be missing. Apply migration before using apply_scope=new_only.',
            });
          }
        }

        preservedUsers = activeSubscribers.length;
      }

      await writeAuditLog(requester.id, 'admin.plan.entitlements.updated', planId, {
        plan_name: plan.name,
        apply_scope: applyScope,
        previous_entitlement_keys: previousEntitlementKeys,
        new_entitlement_keys: uniqueEntitlementKeys,
        affected_active_users: preservedUsers,
      });

      res.json({
        success: true,
        plan_id: planId,
        plan_name: plan.name,
        apply_scope: applyScope,
        entitlement_keys: uniqueEntitlementKeys,
        affected_active_users: preservedUsers,
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
        .from('plan_limits')
        .select('plan_id, limit_key, limit_value, window')
        .eq('plan_id', planId)
        .order('limit_key', { ascending: true });

      if (error) {
        return res.status(500).json({
          error: error.message,
          hint: 'Ensure plan_limits table exists before using limits management.',
        });
      }

      res.json(data || []);
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

      const { data: plan, error: planError } = await supabaseAdmin
        .from('plans')
        .select('id, name')
        .eq('id', planId)
        .single();

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

      const { data: oldLimitRows, error: oldLimitsError } = await supabaseAdmin
        .from('plan_limits')
        .select('limit_key, limit_value, window')
        .eq('plan_id', planId);

      if (oldLimitsError) {
        return res.status(500).json({
          error: oldLimitsError.message,
          hint: 'Ensure plan_limits table exists before using limits management.',
        });
      }

      const previousByKey = new Map<string, { limit_value: number | null; window: LimitWindow }>();
      for (const row of oldLimitRows || []) {
        previousByKey.set((row as any).limit_key, {
          limit_value: (row as any).limit_value,
          window: normalizeLimitWindow((row as any).window),
        });
      }

      const { error: deleteError } = await supabaseAdmin
        .from('plan_limits')
        .delete()
        .eq('plan_id', planId);
      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      if (normalizedLimits.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('plan_limits')
          .insert(normalizedLimits);
        if (insertError) {
          return res.status(500).json({
            error: insertError.message,
            hint: 'Ensure plan_limits table exists before using limits management.',
          });
        }
      }

      let preservedUsers = 0;
      if (applyScope === 'new_only') {
        const { data: activeSubs, error: subsError } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('plan_id', planId)
          .eq('status', 'active');

        if (subsError) {
          return res.status(500).json({ error: subsError.message });
        }

        const nextByKey = new Map<string, { limit_value: number | null; window: LimitWindow }>();
        for (const row of normalizedLimits) {
          nextByKey.set(row.limit_key, { limit_value: row.limit_value, window: row.window });
        }

        const allKeys = new Set([...Array.from(previousByKey.keys()), ...Array.from(nextByKey.keys())]);
        const overrideRows: Array<{
          profile_id: string;
          limit_key: string;
          limit_value: number | null;
          window: LimitWindow;
          enabled: boolean;
        }> = [];

        for (const sub of activeSubs || []) {
          for (const key of allKeys) {
            const previous = previousByKey.get(key);
            const next = nextByKey.get(key);
            const changed = JSON.stringify(previous || null) !== JSON.stringify(next || null);
            if (!changed) continue;

            if (!previous) {
              overrideRows.push({
                profile_id: (sub as any).user_id,
                limit_key: key,
                limit_value: null,
                window: 'none',
                enabled: true,
              });
              continue;
            }

            overrideRows.push({
              profile_id: (sub as any).user_id,
              limit_key: key,
              limit_value: previous.limit_value,
              window: previous.window,
              enabled: true,
            });
          }
        }

        if (overrideRows.length > 0) {
          const { error: overrideError } = await supabaseAdmin
            .from('user_limit_overrides')
            .upsert(overrideRows, { onConflict: 'profile_id,limit_key' });

          if (overrideError) {
            return res.status(500).json({
              error: overrideError.message,
              hint: 'Ensure user_limit_overrides table and unique constraint (profile_id, limit_key) exist before using apply_scope=new_only.',
            });
          }
        }

        preservedUsers = (activeSubs || []).length;
      }

      await writeAuditLog(requester.id, 'admin.plan.limits.updated', planId, {
        plan_name: plan.name,
        apply_scope: applyScope,
        limits: normalizedLimits,
        affected_active_users: preservedUsers,
      });

      res.json({
        success: true,
        plan_id: planId,
        plan_name: plan.name,
        apply_scope: applyScope,
        limits: normalizedLimits,
        affected_active_users: preservedUsers,
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
        .from('plan_prices')
        .select('id, plan_id, interval, amount, currency, stripe_price_id, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          error: error.message,
          hint: 'Ensure plan_prices table exists before using payments management.',
        });
      }

      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/payments/prices/:priceId', clerkMiddleware, requireAdminOrOwner, async (req, res) => {
    try {
      const requester = (req as any).requesterProfile;
      const priceId = req.params.priceId;
      const amount = Number(req.body?.amount);
      const currency = String(req.body?.currency || 'eur').toLowerCase();
      const interval = String(req.body?.interval || 'month').toLowerCase();
      const isActive = req.body?.is_active !== false;

      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(422).json({ error: 'Invalid amount' });
      }

      const { data, error } = await supabaseAdmin
        .from('plan_prices')
        .update({ amount: Math.floor(amount), currency, interval, is_active: isActive })
        .eq('id', priceId)
        .select('*')
        .single();

      if (error) {
        return res.status(500).json({
          error: error.message,
          hint: 'Ensure plan_prices table exists and contains target record.',
        });
      }

      await writeAuditLog(requester.id, 'admin.payments.price.updated', priceId, {
        amount: Math.floor(amount),
        currency,
        interval,
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
    app.get("*", (req, res) => {
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
