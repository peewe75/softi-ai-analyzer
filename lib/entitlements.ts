import { supabaseAdmin } from './supabase.js';

type EntitlementRow = {
  key?: string;
  service_key?: string;
  entitlement_key?: string;
  name?: string;
};

function pickEntitlementKey(row: EntitlementRow): string | null {
  return row.key || row.service_key || row.entitlement_key || row.name || null;
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

export async function resolveEffectiveEntitlements(profileId: string, planId?: string | null) {
  const keys = new Set<string>();

  if (planId) {
    const { data: planEntitlements, error: planError } = await supabaseAdmin
      .from('plan_entitlements')
      .select('entitlements(*)')
      .eq('plan_id', planId);

    if (isMissingTableError(planError)) {
      return [];
    }

    if (!planError && planEntitlements) {
      for (const row of planEntitlements as any[]) {
        const key = pickEntitlementKey(row.entitlements || {});
        if (key) keys.add(key);
      }
    }
  }

  const { data: overrides, error: overrideError } = await supabaseAdmin
    .from('user_entitlement_overrides')
    .select('enabled, entitlements(*)')
    .eq('profile_id', profileId);

  if (isMissingTableError(overrideError)) {
    return Array.from(keys).sort();
  }

  if (!overrideError && overrides) {
    for (const row of overrides as any[]) {
      const key = pickEntitlementKey(row.entitlements || {});
      if (!key) continue;

      if (row.enabled === false) {
        keys.delete(key);
      } else {
        keys.add(key);
      }
    }
  }

  return Array.from(keys).sort();
}
