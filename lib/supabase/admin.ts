import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with service role key. Bypasses RLS.
 * Use only for trusted server operations (e.g. creating a league after we've
 * verified the user via the cookie-based client). Never expose this key to the client.
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is not set (avoids crashing the app on load).
 */
function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export { getAdminClient };
