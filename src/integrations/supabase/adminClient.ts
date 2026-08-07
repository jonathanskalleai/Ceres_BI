import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Admin client — only instantiated when service role key is present.
// WARNING: service_role bypasses RLS. Only acceptable here because this is an
// internal MVP and the key lives in the VPS .env (risk accepted by the owner).
export const supabaseAdmin = SERVICE_ROLE_KEY
  ? createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export const hasAdminClient = !!SERVICE_ROLE_KEY;
