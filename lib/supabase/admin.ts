import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with service role key. Bypasses RLS.
 * Use only for trusted server operations (e.g. creating a league after we've
 * verified the user via the cookie-based client). Never expose this key to the client.
 */
function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it from Supabase Dashboard → Settings → API → service_role (secret)."
    );
  }
  return createClient(url, key);
}

export { getAdminClient };
