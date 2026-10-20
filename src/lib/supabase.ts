import { createBrowserClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Client-side Supabase client.
 * Fetches SUPABASE_URL + SUPABASE_ANON_KEY from /api/config
 * (because those env vars do not have NEXT_PUBLIC_ prefix).
 */
export async function getSupabaseBrowserClient(): Promise<SupabaseClient> {
  if (browserClient) return browserClient;

  const res = await fetch('/api/config');
  if (!res.ok) {
    throw new Error('Failed to load Supabase config');
  }

  const { supabaseUrl, supabaseAnonKey } = await res.json();

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

/**
 * Server-side Supabase client (uses the exact env names from Vercel screenshot)
 */
export function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(url, key);
}
