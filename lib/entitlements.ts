import { supabaseAdmin } from './supabase.js';

function isMissingTableError(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

export async function resolveEffectiveEntitlements(profileId: string, planId?: string | null) {
  const keys = new Set<string>();

  const effectivePlan = planId || 'free';
  const { data: planRow, error: planError } = await supabaseAdmin
    .from('app_billing_plans')
    .select('features')
    .eq('app_id', 'softi')
    .eq('plan_code', effectivePlan)
    .maybeSingle();

  if (isMissingTableError(planError)) {
    return [];
  }

  if (!planError && planRow?.features) {
    for (const feature of planRow.features as string[]) {
      if (feature) keys.add(feature);
    }
  }

  const { data: overrides, error: overrideError } = await supabaseAdmin
    .from('user_entitlement_overrides')
    .select('enabled, entitlement_key')
    .eq('profile_id', profileId);

  if (isMissingTableError(overrideError)) {
    return Array.from(keys).sort();
  }

  if (!overrideError && overrides) {
    for (const row of overrides as any[]) {
      const key = row.entitlement_key as string | null;
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
