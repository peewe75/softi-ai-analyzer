# Deploy Runbook (Gated)

## Pipeline Gates

1. `npm run lint`
2. `npm run build`
3. Integration smoke (`/api/health`, `/api/admin/*`, `/api/me/entitlements`)
4. Staging deploy
5. Manual approval -> production deploy

## Pre-Deploy Checks

- Confirm latest files are present on server:
  - `server.ts`
  - `src/components/MainDashboard.tsx`
  - `src/components/admin/AdminPanel.tsx`
- Verify environment variables for Clerk and Supabase are set.
- Confirm reverse proxy forwards all HTTP methods (`GET`, `POST`, `PATCH`) under `/api/`.

## Required Incremental SQL (Supabase)

Run this in Supabase SQL editor before deploying new limits/payments APIs:

```sql
CREATE TABLE IF NOT EXISTS user_entitlement_overrides (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, entitlement_id)
);

CREATE TABLE IF NOT EXISTS plan_limits (
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INTEGER,
    window TEXT NOT NULL DEFAULT 'none' CHECK (window IN ('none', 'daily', 'monthly')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (plan_id, limit_key)
);

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

CREATE TABLE IF NOT EXISTS plan_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    interval TEXT NOT NULL CHECK (interval IN ('week', 'month', 'year')),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'eur',
    stripe_price_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_price_id UUID REFERENCES plan_prices(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    billing_subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
    amount INTEGER,
    currency TEXT DEFAULT 'eur',
    status TEXT DEFAULT 'pending',
    provider TEXT DEFAULT 'stripe',
    provider_event_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Production Deploy Steps

1. Upload/merge code changes.
2. Run:
   - `npm ci`
   - `npm run build`
3. Restart process manager (PM2/systemd).
4. Verify health:
   - `GET /api/health` -> `200`
5. Verify API auth behavior:
   - `GET /api/admin/users` without token -> `401`
   - `PATCH /api/admin/users/:id/role` without token -> `401`
   - `POST /api/admin/users/:id/role` without token -> `401`
6. Browser hard refresh (`Ctrl+F5`) and smoke test admin flow.

## Post-Deploy Validation

- Admin users list loads.
- Role update works and persists after logout/login.
- Subscription update works.
- Plans tab saves entitlement changes for both scopes.
- No `Unexpected token '<'` errors in console.
- No intermittent `404` on `/api/me/entitlements` during login bootstrap.

## Rollback Procedure

1. Revert to previous release artifact or commit.
2. Restart application process.
3. Run smoke checks on `/api/health` and `/api/admin/users`.
4. Confirm error rate returns to baseline.

## Observability Checklist

- Track 4xx/5xx rates on `/api/admin/*`.
- Watch for auth failures in Clerk middleware logs.
- Watch for `CLERK ROLE SYNC ERROR` events.
- Watch for `user_entitlement_overrides` update errors on `new_only` scope.
