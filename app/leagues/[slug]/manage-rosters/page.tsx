import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabase as publicSupabase } from "@/lib/supabase";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { normalizeWrestlerRowFromApi } from "@/lib/leagueDraft";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";
import { RostersSection } from "../RostersSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Manage Rosters — Draftastic Fantasy" };
  return {
    title: `Manage Rosters — ${league.name} — Draftastic Fantasy`,
    description: "Manually add or remove wrestlers from any faction roster (offline draft, corrections).",
  };
}

export default async function ManageRostersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  const members = await getLeagueMembers(league.id);
  const rosters = await getRostersForLeague(league.id);
  const rosterRules = getRosterRulesForLeague(members.length, league.season_slug ?? null, Boolean(league.include_nxt));

  const db = getAdminClient() ?? publicSupabase;
  let result: Record<string, unknown>[] | null = null;

  const primary = await db
    .from("wrestlers")
    .select('id, name, gender, "Status", brand, roster, "Roster", "Classification"')
    .order("name", { ascending: true });
  if (!primary.error) {
    result = (primary.data ?? []) as Record<string, unknown>[];
  } else {
    const fallback = await db
      .from("wrestlers")
      .select('id, name, gender, "Status", brand, "Classification"')
      .order("name", { ascending: true });
    if (!fallback.error) {
      result = (fallback.data ?? []) as Record<string, unknown>[];
    } else {
      const minimal = await db
        .from("wrestlers")
        .select('id, name, gender, brand, "Status"')
        .order("name", { ascending: true });
      result = minimal.error ? [] : ((minimal.data ?? []) as Record<string, unknown>[]);
    }
  }

  const rawRows = (result ?? []) as Record<string, unknown>[];
  const wrestlers = rawRows
    .map((r) => {
      const id = String(r.id ?? r.Id ?? "");
      const name = String(r.name ?? r.Name ?? r.id ?? r.Id ?? "");
      const norm = normalizeWrestlerRowFromApi(r);
      const rawGender = r.gender ?? r.Gender;
      const gender = rawGender != null && String(rawGender).trim() !== "" ? String(rawGender) : null;
      const brandRaw = r.brand ?? r.Brand ?? r.roster ?? r.Roster ?? null;
      const brand = brandRaw != null && String(brandRaw).trim() !== "" ? String(brandRaw) : null;
      const classificationRaw = r.classification ?? r.Classification ?? norm.classification ?? null;
      const classification =
        classificationRaw != null && String(classificationRaw).trim() !== ""
          ? String(classificationRaw).trim().toLowerCase()
          : "";
      // Keep the broader brand fallback (brand/Brand/roster/Roster) even when normalize helper has no brand.
      return { ...r, ...norm, id, name, gender, brand, classification };
    })
    .filter((w) => {
      if (!w.id) return false;
      const rosterBucket = wrestlerRosterFromBrand(w.brand ?? null);
      if (!(rosterBucket === "Raw" || rosterBucket === "SmackDown" || rosterBucket === "NXT")) return false;
      if (w.classification === "non-wrestlers" || w.classification === "alumni") return false;
      return true;
    })
    .map((w) => ({ id: w.id, name: w.name ?? w.id, gender: w.gender ?? null }))
    .sort((a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id), undefined, { sensitivity: "base" }));

  return (
    <main className="app-page">
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Manage Rosters
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 560 }}>
        As the GM, you can manually add or remove wrestlers from any faction&apos;s roster. Use this after an offline draft to enter results, or to fix drafting errors. Managers cannot edit rosters directly; they submit add/drop requests that you approve or decline on Pending Transactions.
      </p>
      <div className="lm-card">
        <RostersSection
          leagueId={league.id}
          leagueSlug={slug}
          members={members}
          rosters={rosters}
          wrestlers={wrestlers}
          isCommissioner={league.role === "commissioner"}
          rosterRules={rosterRules}
          teamCount={members.length}
        />
      </div>
    </main>
  );
}
