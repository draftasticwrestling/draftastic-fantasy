import { config } from "dotenv";
config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: leagues, error } = await admin
    .from("leagues")
    .select("id, name, slug, draft_type, draft_status, season_slug, max_teams")
    .eq("season_slug", "road-to-war-games");
  if (error) throw error;
  console.log("R2WG leagues:", leagues?.length ?? 0);
  for (const lg of leagues ?? []) {
    const { count: members } = await admin
      .from("league_members")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", lg.id);
    const { count: prefs } = await admin
      .from("league_draft_preferences")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", lg.id);
    console.log(
      `- ${lg.name} (${lg.slug}) type=${lg.draft_type} status=${lg.draft_status} members=${members} prefs=${prefs}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
