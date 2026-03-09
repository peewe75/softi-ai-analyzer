# Implementation Plan: SOFTI AI Commercial System

## Goal

Integrate a complete commercial layer into SOFTI AI Analyzer using Clerk for authentication and Supabase for the database, including role-based access control (RBAC), subscription management (Stripe-ready stubs), and an administrative panel.

## Proposed Changes

### 1. Foundations & Environment

- **[MODIFY] .env**: Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`.
- **[MODIFY] src/vite-env.d.ts**: Add type definitions for new environment variables.

### 2. Authentication & Routing

- **[MODIFY] src/main.tsx**: Wrap `App` with `ClerkProvider`.
- **[MODIFY] src/App.tsx**:
  - Implement routing: `/` (Landing), `/app/*` (Private), `/admin/*` (Admin).
  - Add Clerk `SignIn`, `SignUp`, and `UserButton`.
  - Filter features based on user entitlements.
- **[MODIFY] server.ts**:
  - Add Clerk Express middleware to protect `/api/me/*` and `/api/admin/*` routes.
  - Implement role-based access control on the backend.

### 3. Frontend Modularization (Refactoring)

- **[DONE] src/types/index.ts**: Centralized interfaces and types.
- **[DONE] src/constants/market.ts**: Extracted asset database and data feeds.
- **[DONE] src/lib/utils.ts**: Shared utility functions.

### Frontend Components

The `App.tsx` has been successfully modularized into several focused components:

#### [DONE] [Sidebar.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/Sidebar.tsx)

#### [DONE] [TopBar.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/TopBar.tsx)

#### [DONE] [OverviewTab.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/dashboard/OverviewTab.tsx)

#### [DONE] [AnalysisTab.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/dashboard/AnalysisTab.tsx)

#### [DONE] [FeedsTab.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/dashboard/FeedsTab.tsx)

#### [DONE] [AutomationTab.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/dashboard/AutomationTab.tsx)

#### [DONE] [ReportsTab.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/dashboard/ReportsTab.tsx)

#### [DONE] [SupportTab.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/dashboard/SupportTab.tsx)

#### [DONE] [SettingsTab.tsx](file:///c:/Users/avvsa/OneDrive%20-%20AVVOCATO%20SAPONE/Desktop/Marco/softi-ai-analyzer/src/components/dashboard/SettingsTab.tsx)

---

### Backend & Auth Sync

- **[NEW] src/components/MainDashboard.tsx**: Main protected container.

### 4. Database & Sync

- **[DONE] Migration**: Initial schema applied to Supabase.
- **[NEW] lib/clerk-sync.ts**: Logic for syncing Clerk users to Supabase `profiles` (mapping `clerk_user_id`).
- **[NEW] lib/entitlements.ts**: Backend utility to resolve effective entitlements for a user.

### 4. Admin & Features

- **[NEW] src/components/admin/AdminPanel.tsx**: Dashboard for managing users, roles, and overrides.
- **[NEW] src/components/LandingPage.tsx**: Public landing page with CTA.
- **[MODIFY] src/App.tsx**: Integrate new components and routing logic.

### 5. Billing (Stripe-ready)

- **[NEW] server/routes/billing.ts**: API stubs for `/api/billing/checkout` and `/api/billing/webhook`.

## Verification Plan

### Automated Tests

- Verification of Supabase client connectivity.
- Backend middleware test using mock Clerk tokens.

### Manual Verification

- **SignUp Flow**: Verify a new Clerk user is created and assigned a `free` subscription in Supabase.
- **Access Control**: Log in as a `user` and attempt to access `/admin` or pro features.
- **Admin Actions**: Log in as `owner` and change a user's role or grant an override.
