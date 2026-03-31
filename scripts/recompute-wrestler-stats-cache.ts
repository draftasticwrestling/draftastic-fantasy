import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { recomputeWrestlerStatsCache } from "../lib/recomputeWrestlerStatsCache";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("Recomputing wrestler_stats_cache...");
  const summary = await recomputeWrestlerStatsCache(supabase);
  console.log(
    `wrestler_stats_cache recompute complete. wrestlers=${summary.wrestlers} events=${summary.events} rows=${summary.rows}`
  );
}

main().catch((err) => {
  console.error("Failed to recompute wrestler_stats_cache:");
  console.error(err);
  process.exit(1);
});

