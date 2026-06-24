import { createClient } from '@supabase/supabase-js';

/**
 * Public anon client (browser + server). Never uses the service role key.
 *
 * If NEXT_PUBLIC_SUPABASE_* are unset, we still create a client with placeholders so
 * `next dev` / first paint does not crash. Network calls will fail until you add
 * real values to `.env.local` (copy from `.env.example`).
 */
const PLACEHOLDER_URL = 'https://__set-env__.supabase.co';
/** Minimal JWT-shaped string so @supabase/supabase-js accepts the client (requests will 401 until real key is set). */
const PLACEHOLDER_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Il9fZW52X18iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMH0.placeholder';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(rawUrl && rawKey);

const supabaseUrl = rawUrl || PLACEHOLDER_URL;
const supabaseKey = rawKey || PLACEHOLDER_ANON;

if (!isSupabaseConfigured) {
    const msg =
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add them to .env.local (see .env.example). Using placeholder; auth and data requests will fail until configured.';
    if (process.env.NODE_ENV === 'development') {
        console.warn(`[supabase] ${msg}`);
    } else {
        console.error(`[supabase] ${msg}`);
    }
}

export const supabase = createClient(supabaseUrl, supabaseKey);
