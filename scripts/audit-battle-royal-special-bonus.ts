import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { scoreEvent } from "../lib/scoring/scoreEvent.js";
import { isBattleRoyal, isRoyalRumbleMatch } from "../lib/scoring/extractors/matches.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, date, status, matches")
    .eq("status", "completed")
    .order("date", { ascending: false });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = (events ?? []) as Array<{
    id: string;
    name?: string | null;
    date?: string | null;
    status?: string | null;
    matches?: unknown[];
  }>;

  let targetMatches = 0;
  let suspiciousRows = 0;
  const findings: Array<{
    eventDate: string;
    eventName: string;
    eventId: string;
    matchOrder: string;
    wrestler: string;
    specialPoints: number;
    breakdown: string[];
  }> = [];

  for (const event of rows) {
    const scored = scoreEvent(event) as {
      matches?: Array<{ isPromo?: boolean; wrestlerPoints?: unknown[] }>;
    };
    const rawMatches = (event.matches ?? []) as Array<Record<string, unknown>>;
    for (let i = 0; i < rawMatches.length; i += 1) {
      const raw = rawMatches[i] ?? {};
      const scoredMatch = scored.matches?.[i];
      if (!scoredMatch || scoredMatch.isPromo || !Array.isArray(scoredMatch.wrestlerPoints)) continue;
      const isTarget = isRoyalRumbleMatch(raw) || (isBattleRoyal(raw) && !isRoyalRumbleMatch(raw));
      if (!isTarget) continue;
      targetMatches += 1;

      for (const wp of scoredMatch.wrestlerPoints) {
        const specialPoints = Number((wp as { specialPoints?: number }).specialPoints ?? 0);
        const breakdown = Array.isArray((wp as { breakdown?: unknown[] }).breakdown)
          ? ((wp as { breakdown?: unknown[] }).breakdown ?? []).filter((x): x is string => typeof x === "string")
          : [];
        const hasGenericBonus = breakdown.some((line) =>
          line.toLowerCase().includes("special match victory bonus")
        );
        if (specialPoints > 0 && hasGenericBonus) {
          suspiciousRows += 1;
          findings.push({
            eventDate: String(event.date ?? "").slice(0, 10),
            eventName: String(event.name ?? event.id),
            eventId: event.id,
            matchOrder: String((raw as { order?: string | number }).order ?? i + 1),
            wrestler: String((wp as { wrestler?: string }).wrestler ?? "unknown"),
            specialPoints,
            breakdown,
          });
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        completedEventsScanned: rows.length,
        battleRoyalOrRumbleMatchesScanned: targetMatches,
        suspiciousRows,
      },
      null,
      2
    )
  );

  if (findings.length) {
    console.log("\nSuspicious rows:");
    for (const f of findings.slice(0, 40)) {
      console.log(
        `- ${f.eventDate} | ${f.eventName} (${f.eventId}) | match ${f.matchOrder} | ${f.wrestler} | special=${f.specialPoints}`
      );
      for (const line of f.breakdown.filter((x) => x.toLowerCase().includes("special match victory bonus"))) {
        console.log(`    ${line}`);
      }
    }
    if (findings.length > 40) {
      console.log(`...and ${findings.length - 40} more`);
    }
    process.exitCode = 2;
    return;
  }

  console.log("\nNo generic special-victory bonus rows detected for battle royal / royal rumble matches.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
