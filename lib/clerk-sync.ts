import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase.js';

export async function syncClerkUser(
  _clerkUserId: string,
  email: string,
  firstName?: string,
  lastName?: string,
  roleOverride?: string
) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Missing email for Clerk sync');
    }

    const { data: profile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (getError) {
      throw getError;
    }

    const role = roleOverride || profile?.role || 'user';
    const normalizedFirstName = firstName?.trim() || null;
    const normalizedLastName = lastName?.trim() || null;

    if (!profile) {
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: randomUUID(),
          email: normalizedEmail,
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          role,
        })
        .select()
        .single();

      if (createError) throw createError;

      console.log(`Successfully synced new user: ${normalizedEmail} as ${role}`);
      return newProfile;
    }

    const updatePayload: Record<string, unknown> = {};

    if (normalizedFirstName !== (profile.first_name ?? null)) {
      updatePayload.first_name = normalizedFirstName;
    }

    if (normalizedLastName !== (profile.last_name ?? null)) {
      updatePayload.last_name = normalizedLastName;
    }

    if (Object.keys(updatePayload).length === 0) {
      return profile;
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', profile.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return updatedProfile;
  } catch (error) {
    console.error('Error syncing Clerk user to Supabase:', error);
    throw error;
  }
}
