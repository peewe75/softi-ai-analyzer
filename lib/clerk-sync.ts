import { supabaseAdmin } from './supabase.js';

export async function syncClerkUser(clerkUserId: string, email: string, firstName?: string, lastName?: string, roleOverride?: string) {
    try {
        // 1. Check if profile exists
        const { data: profile, error: getError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('clerk_user_id', clerkUserId)
            .single();

        if (getError && getError.code !== 'PGRST116') {
            throw getError;
        }

        const role = roleOverride || 'user';
        const fullName = `${firstName || ''} ${lastName || ''}`.trim();

        if (!profile) {
            // 2. Create profile
            const { data: newProfile, error: createError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: crypto.randomUUID(),
                    clerk_user_id: clerkUserId,
                    email,
                    full_name: fullName,
                    role
                })
                .select()
                .single();

            if (createError) throw createError;

            // 3. Assign default 'free' plan if not already there
            const { data: freePlan } = await supabaseAdmin
                .from('plans')
                .select('id')
                .eq('name', 'free')
                .single();

            if (freePlan) {
                const { error: subscriptionError } = await supabaseAdmin
                    .from('subscriptions')
                    .insert({
                        user_id: newProfile.id,
                        plan_id: freePlan.id,
                        status: 'active'
                    });

                if (subscriptionError) {
                    throw subscriptionError;
                }
            }

            console.log(`Successfully synced new user: ${email} as ${role}`);
            return newProfile;
        }

        const updatePayload: Record<string, unknown> = {};

        if (email && profile.email !== email) {
            updatePayload.email = email;
        }

        if (fullName && profile.full_name !== fullName) {
            updatePayload.full_name = fullName;
        }

        // Update role only when explicitly provided by trusted backend source
        if (roleOverride && profile.role !== roleOverride) {
            updatePayload.role = roleOverride;
        }

        if (Object.keys(updatePayload).length > 0) {
            const { data: updatedProfile, error: updateError } = await supabaseAdmin
                .from('profiles')
                .update(updatePayload)
                .eq('clerk_user_id', clerkUserId)
                .select()
                .single();

            if (updateError) throw updateError;
            console.log(`[SYNC DEBUG] Updated profile in Supabase for ${email}. New role: ${updatedProfile.role}`);
            return updatedProfile;
        }

        return profile;
    } catch (error) {
        console.error('Error syncing Clerk user to Supabase:', error);
        throw error;
    }
}
