-- ============================================================
-- SOFTI AI - Safe Migration (IF NOT EXISTS - no data loss)
-- Run this in Supabase SQL Editor if tables are missing
-- ============================================================

-- Helper function for updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Analysis Archives (AI caching)
CREATE TABLE IF NOT EXISTS analysis_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_archives_hash_expiry ON analysis_archives (query_hash, expires_at);

-- Plan Limits
CREATE TABLE IF NOT EXISTS plan_limits (
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INTEGER,
    window TEXT NOT NULL DEFAULT 'none' CHECK (window IN ('none', 'daily', 'monthly')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (plan_id, limit_key)
);

-- User Limit Overrides
CREATE TABLE IF NOT EXISTS user_limit_overrides (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INTEGER,
    window TEXT NOT NULL DEFAULT 'none' CHECK (window IN ('none', 'daily', 'monthly')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, limit_key)
);

-- Usage Counters
CREATE TABLE IF NOT EXISTS usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_unique
    ON usage_counters(profile_id, metric_key, window_start, window_end);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT REFERENCES profiles(id),
    action TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default plan limits (only if plans exist and limits table is empty)
INSERT INTO plan_limits (plan_id, limit_key, limit_value, window)
SELECT id, 'max_assets_per_analysis', 3, 'none' FROM plans
WHERE NOT EXISTS (SELECT 1 FROM plan_limits WHERE limit_key = 'max_assets_per_analysis');

INSERT INTO plan_limits (plan_id, limit_key, limit_value, window)
SELECT id,
       'advanced_analysis_max_requests',
       CASE
         WHEN name = 'free' THEN 10
         WHEN name = 'lite' THEN 60
         WHEN name = 'pro' THEN 300
         WHEN name = 'premium' THEN NULL
         ELSE 100
       END,
       'monthly'
FROM plans
WHERE NOT EXISTS (SELECT 1 FROM plan_limits WHERE limit_key = 'advanced_analysis_max_requests');

-- Add lite plan entitlements if missing
INSERT INTO plan_entitlements (plan_id, entitlement_id)
SELECT p.id, e.id FROM plans p, entitlements e
WHERE p.name = 'lite' AND e.name IN ('basic_analysis', 'advanced_analysis')
ON CONFLICT DO NOTHING;
