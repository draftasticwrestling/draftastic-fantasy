import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Don't throw at load time so the app can load on Netlify even if env vars
// aren't set yet. Requests will fail with a clear error from Supabase.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
