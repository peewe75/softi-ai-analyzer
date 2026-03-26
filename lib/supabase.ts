import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) console.error('CRITICAL: SUPABASE_URL missing');
if (!supabaseServiceKey) console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY missing');

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
