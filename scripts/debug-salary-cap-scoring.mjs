import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { getLeagueScoring } = await import("../lib/leagues.ts");
  const { scoreEvent } = await import("../lib/scoring/scoreEvent.js");

  const { data: full } = await supabase
    .from("events")
    .select("*")
    .eq("id", "clash-in-italy-20260531-1775499385688")
    .single();

  const scored = scoreEvent(full);
  console.log("scoreEvent matches with points:");
  for (const m of scored.matches) {
    const withPts = (m.wrestlerPoints || []).filter((wp) => wp.total > 0);
    if (withPts.length) console.log(" order", m.order, withPts.map((wp) => `${wp.wrestler}:${wp.total}`));
  }

  for (const slug of ["salary-cap-test-1", "salary-cap-test"]) {
    const { data: league } = await supabase
      .from("leagues")
      .select("id, slug, start_date, end_date")
      .eq("slug", slug)
      .single();
    const { data: members } = await supabase
      .from("league_members")
      .select("user_id, display_name, team_name")
      .eq("league_id", league.id);
    const nameBy = Object.fromEntries(
      (members ?? []).map((m) => [m.user_id, m.display_name || m.team_name])
    );
    const scoring = await getLeagueScoring(league.id, supabase);
    const owners = Object.entries(scoring.pointsByOwner).filter(([, v]) => v > 0);
    console.log("\n===", slug, "start", league.start_date, "owners with points:", owners.length);
    for (const [uid, pts] of owners.sort((a, b) => b[1] - a[1])) {
      console.log(" ", nameBy[uid] || uid.slice(0, 8), pts);
    }
    for (const w of ["gunther", "cody-rhodes", "rhea-ripley", "oba-femi", "damian-priest"]) {
      for (const [uid, wmap] of Object.entries(scoring.pointsByOwnerByWrestler)) {
        if (wmap[w]) console.log(" ", w, "->", nameBy[uid] || uid.slice(0, 8), wmap[w]);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
