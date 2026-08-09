import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabase as publicSupabase } from "@/lib/supabase";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getMinimumTeamsForLeagueType,
  getRosterRulesForLeague,
  leagueIncludesNxt,
  leagueUsesSalaryCap,
} from "@/lib/leagueStructure";
import { normalizeWrestlerRowFromApi } from "@/lib/leagueDraft";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";
import { getLeagueRosterValidationFailures } from "@/lib/leagueRosterValidation";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { RostersSection } from "../RostersSection";
import { submitOfflineDraftForReviewAction } from "../actions";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { slug } = await params;
  const { ok, err } = await searchParams;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (leagueUsesSalaryCap(league.league_type)) notFound();
  const members = await getLeagueMembers(league.id);
  const rosters = await getRostersForLeague(league.id);
  const rosterRules = getRosterRulesForLeague(
    members.length,
    league.season_slug ?? null,
    leagueIncludesNxt(league),
    league.league_type ?? null
  );
  const isSiteAdmin = await getIsSiteAdmin();
  const canSubmitOffline = league.role === "commissioner" || isSiteAdmin;
  const isOffline = String(league.draft_type ?? "").toLowerCase() === "offline";
  const draftStatus = String(league.draft_status ?? "not_started");
  const minTeams = getMinimumTeamsForLeagueType(league.league_type);
  const rosterFailures =
    isOffline && draftStatus !== "completed" && draftStatus !== "ready_for_review"
      ? await getLeagueRosterValidationFailures(league.id)
      : [];
  const canSubmitNow =
    isOffline &&
    canSubmitOffline &&
    draftStatus !== "completed" &&
    draftStatus !== "ready_for_review" &&
    members.length >= minTeams;

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

      {ok ? (
        <p
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-blue-bg, #eef5ff)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
            fontSize: 14,
          }}
        >
          {ok}
        </p>
      ) : null}
      {err ? (
        <p
          role="alert"
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-red-bg, #fff5f5)",
            border: "1px solid #fecaca",
            color: "var(--color-text)",
            fontSize: 14,
          }}
        >
          {err}
        </p>
      ) : null}

      {isOffline && canSubmitOffline && draftStatus !== "completed" ? (
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            background: "var(--color-bg-surface)",
            maxWidth: 640,
          }}
        >
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 8px", color: "var(--color-text)" }}>
            Finalize offline draft
          </h2>
          {draftStatus === "ready_for_review" ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Automatic roster validation found issues. Draft is awaiting site admin approval.
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                When every faction has a complete roster, finalize the draft. If size and gender minimums pass, the draft
                is approved automatically. If validation fails, it goes to site admin review.
              </p>
              {members.length < minTeams ? (
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "#92400e" }}>
                  Need at least {minTeams} factions (currently {members.length}).
                </p>
              ) : null}
              {rosterFailures.length > 0 ? (
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "#92400e" }}>
                  {rosterFailures.length} faction(s) still need a complete roster — finalizing will send the draft to
                  admin review until those are fixed (or an admin overrides).
                </p>
              ) : null}
              <form action={submitOfflineDraftForReviewAction}>
                <input type="hidden" name="leagueSlug" value={slug} />
                <button type="submit" className="admin-article-submit" disabled={members.length < minTeams}>
                  {rosterFailures.length > 0
                    ? "Submit for admin review (roster issues)"
                    : "Finalize offline draft"}
                </button>
              </form>
            </>
          )}
        </section>
      ) : null}

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
