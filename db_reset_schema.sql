-- 1. DROP EVERYTHING (Clean slate)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS billing_subscriptions CASCADE;
DROP TABLE IF EXISTS billing_customers CASCADE;
DROP TABLE IF EXISTS user_entitlement_overrides CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plan_entitlements CASCADE;
DROP TABLE IF EXISTS entitlements CASCADE;
DROP TABLE IF EXISTS plan_prices CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS analysis_archives CASCADE;
DROP TABLE IF EXISTS analysis_snapshots CASCADE;
DROP TABLE IF EXISTS usage_counters CASCADE;
-- Other tables
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS tenant_usage_daily CASCADE;
DROP TABLE IF EXISTS consents CASCADE;
DROP TABLE IF EXISTS affiliates CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenant_settings CASCADE;
DROP TABLE IF EXISTS tenant_keys CASCADE;
DROP TABLE IF EXISTS affiliate_settings CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- 2. CREATE CORE SCHEMA

-- Function for updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Profiles
CREATE TABLE profiles (
    id TEXT PRIMARY KEY, -- Clerk User ID
    clerk_user_id TEXT UNIQUE,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Plans
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Entitlements (Services/Features)
CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Plan Entitlements (Mapping)
CREATE TABLE plan_entitlements (
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    entitlement_id UUID REFERENCES entitlements(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, entitlement_id)
);

-- Plan Limits (Numeric quotas)
CREATE TABLE plan_limits (
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INTEGER,
    window TEXT NOT NULL DEFAULT 'none' CHECK (window IN ('none', 'daily', 'monthly')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (plan_id, limit_key)
);

-- User Entitlement Overrides
CREATE TABLE user_entitlement_overrides (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, entitlement_id)
);

-- User Limit Overrides
CREATE TABLE user_limit_overrides (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INTEGER,
    window TEXT NOT NULL DEFAULT 'none' CHECK (window IN ('none', 'daily', 'monthly')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, limit_key)
);

-- Analysis Archives (Caching)
CREATE TABLE analysis_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL, -- 'report', 'analysis', 'market_data'
    target_id TEXT NOT NULL,   -- e.g. 'EURUSD, BTC'
    query_hash TEXT NOT NULL, -- MD5 hash or unique string of parameters
    content TEXT NOT NULL,     -- The full AI response
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_archives_hash_expiry ON analysis_archives (query_hash, expires_at);

-- Usage Counters
CREATE TABLE usage_counters (
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

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active',
    current_period_start TIMESTAMPTZ DEFAULT now(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Plan Prices (Payments)
CREATE TABLE plan_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'eur',
    stripe_price_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billing customers (Stripe-ready)
CREATE TABLE billing_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billing subscriptions (Stripe-ready)
CREATE TABLE billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment events/ledger
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT UNIQUE,
    amount INTEGER,
    currency TEXT DEFAULT 'eur',
    status TEXT DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT REFERENCES profiles(id),
    action TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRIGGERS
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_entitlements_updated_at BEFORE UPDATE ON public.entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plan_limits_updated_at BEFORE UPDATE ON public.plan_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_limit_overrides_updated_at BEFORE UPDATE ON public.user_limit_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_usage_counters_updated_at BEFORE UPDATE ON public.usage_counters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plan_prices_updated_at BEFORE UPDATE ON public.plan_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_billing_subscriptions_updated_at BEFORE UPDATE ON public.billing_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_billing_customers_updated_at BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_entitlement_overrides_updated_at BEFORE UPDATE ON public.user_entitlement_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_audit_logs_updated_at BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. INITIAL DATA POPULATION

-- Plans
INSERT INTO plans (name, description) VALUES
('free', 'Accesso gratuito con funzionalità limitate'),
('lite', 'Analisi essenziali per trader occasionali'),
('pro', 'Analisi avanzate e integrazione MT5 completa'),
('premium', 'L''esperienza completa con supporto prioritario');

-- Entitlements
INSERT INTO entitlements (name, description) VALUES
('basic_analysis', 'Accesso alle analisi base'),
('advanced_analysis', 'Accesso alle analisi IA avanzate'),
('mt5_bridge', 'Collegamento diretto con MetaTrader 5'),
('premium_signals', 'Segnali operativi premium');

-- Associate Entitlements to Plans
-- Free gets basic
INSERT INTO plan_entitlements (plan_id, entitlement_id)
SELECT p.id, e.id FROM plans p, entitlements e
WHERE p.name = 'free' AND e.name = 'basic_analysis';

-- Pro gets basic, advanced, and mt5
INSERT INTO plan_entitlements (plan_id, entitlement_id)
SELECT p.id, e.id FROM plans p, entitlements e
WHERE p.name = 'pro' AND e.name IN ('basic_analysis', 'advanced_analysis', 'mt5_bridge');

-- Premium gets everything
INSERT INTO plan_entitlements (plan_id, entitlement_id)
SELECT p.id, e.id FROM plans p, entitlements e
WHERE p.name = 'premium';

-- Default limits per plan
INSERT INTO plan_limits (plan_id, limit_key, limit_value, window)
SELECT id, 'max_assets_per_analysis', 3, 'none' FROM plans;

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
FROM plans;
