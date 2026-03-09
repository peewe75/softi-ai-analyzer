import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    console.error('❌ CRITICAL: SUPABASE_URL or VITE_SUPABASE_URL is missing in .env');
}
if (!supabaseServiceKey) {
    console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY is missing in .env');
}

// Service key client for admin actions (bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '');
