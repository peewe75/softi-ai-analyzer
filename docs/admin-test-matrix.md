# Admin Test Matrix

## Scope

- Admin authorization and routing
- User role and subscription updates
- Plan entitlement management with apply scope
- Clerk/Supabase role sync safety
- Entitlement bootstrap stability

## Functional Cases

| ID | Area | Scenario | Expected Result | Severity |
| --- | --- | --- | --- | --- |
| A1 | AuthZ | `user` calls `/api/admin/users` | `403`/redirect on UI, no data exposure | Critical |
| A2 | AuthZ | `admin` opens `/admin` | Admin panel loads successfully | Critical |
| A3 | Role update | `PATCH /api/admin/users/:id/role` valid payload | 200 + role persisted in `profiles` | High |
| A4 | Role update | `POST /api/admin/users/:id/role` fallback path | 200 + role persisted | High |
| A5 | Role validation | invalid role payload | `422` and no DB write | High |
| A6 | Subscription update | valid plan update | 200 + active subscription updated | High |
| A7 | Plan management | Save plan entitlements scope `all_active_and_new` | Active and future subscribers follow new mapping | Critical |
| A8 | Plan management | Save plan entitlements scope `new_only` | Current active users keep previous access, new subscribers get new mapping | Critical |
| A9 | Entitlements API | `/api/me/entitlements` after login | Returns `200` and entitlement array (no intermittent 404) | Critical |
| A10 | Sync safety | role changed in admin panel then logout/login | Role remains stable, no unwanted overwrite by `/api/auth/sync` | Critical |

## Negative Cases

| ID | Scenario | Expected Result | Severity |
| --- | --- | --- | --- |
| N1 | Missing bearer token on admin APIs | `401 Unauthorized` | High |
| N2 | Expired/invalid token | `401`/`403` without server crash | High |
| N3 | Non-JSON fallback from proxy | UI shows controlled error, no JSON parse crash | High |
| N4 | Invalid entitlement keys in plan update | `422` + list of invalid keys | Medium |
| N5 | `new_only` without overrides table constraints | API returns actionable error message | Medium |

## Smoke Checklist (VPS)

1. Login as admin and open `/admin`.
2. Change one user role and refresh page.
3. Logout/login as changed user and verify role behavior.
4. Open tab `PLANS`, toggle one entitlement in `pro`, save with `all_active_and_new`.
5. Verify plan-gated tabs in `/app` for a `pro` user.
6. Revert same plan and save with `new_only`, validate current active user remains unchanged.
7. Check latest `audit_logs` entries for role/subscription/plan updates.

## Coverage Gaps to Close Next

- Automated integration tests with mocked Clerk token verification.
- E2E automation for admin plan flow with two test accounts.
- Proxy-level tests to ensure `/api/*` never falls back to HTML.
