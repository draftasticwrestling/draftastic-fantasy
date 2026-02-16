import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { EXAMPLE_LEAGUE } from "@/lib/league";

const LEAGUE_SLUG = EXAMPLE_LEAGUE.slug;

export type RosterAssignmentRow = {
  league_slug: string;
  owner_slug: string;
  wrestler_id: string;
  contract: string | null;
  created_at?: string;
};

/**
 * GET /api/league/roster
 * Returns all roster assignments for the league (owner_slug -> { wrestler_id, contract }[]).
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("roster_assignments")
      .select("owner_slug, wrestler_id, contract")
      .eq("league_slug", LEAGUE_SLUG)
      .order("owner_slug")
      .order("wrestler_id");

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: "Ensure roster_assignments table exists (see supabase/roster_assignments.sql)" },
        { status: 500 }
      );
    }

    const byOwner: Record<string, { wrestler_id: string; contract: string | null }[]> = {};
    for (const row of data ?? []) {
      const r = row as RosterAssignmentRow;
      if (!byOwner[r.owner_slug]) byOwner[r.owner_slug] = [];
      byOwner[r.owner_slug].push({ wrestler_id: r.wrestler_id, contract: r.contract ?? null });
    }
    return NextResponse.json({ league_slug: LEAGUE_SLUG, assignments: byOwner });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/league/roster
 * Body: { action: "set" | "delete", owner_slug: string, wrestler_id: string, contract?: string }
 * - set: upsert assignment (contract e.g. "3 yr", "2 yr", "1 yr")
 * - delete: remove assignment
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, owner_slug, wrestler_id, contract } = body as {
      action?: string;
      owner_slug?: string;
      wrestler_id?: string;
      contract?: string | null;
    };

    if (!owner_slug || !wrestler_id) {
      return NextResponse.json(
        { error: "owner_slug and wrestler_id are required" },
        { status: 400 }
      );
    }

    if (action === "delete") {
      const { error } = await supabase
        .from("roster_assignments")
        .delete()
        .eq("league_slug", LEAGUE_SLUG)
        .eq("owner_slug", owner_slug)
        .eq("wrestler_id", wrestler_id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, action: "deleted" });
    }

    const row = {
      league_slug: LEAGUE_SLUG,
      owner_slug,
      wrestler_id,
      contract: contract ?? null,
    };

    const { error: upsertError } = await supabase
      .from("roster_assignments")
      .upsert(row, { onConflict: "league_slug,owner_slug,wrestler_id" });

    if (upsertError) {
      const tryInsert =
        upsertError.code === "42P10" ||
        upsertError.message?.includes("ON CONFLICT") ||
        upsertError.message?.includes("unique");
      if (tryInsert) {
        const { error: insertError } = await supabase
          .from("roster_assignments")
          .insert(row);
        if (insertError) {
          if (insertError.code === "23505") {
            const { error: updateError } = await supabase
              .from("roster_assignments")
              .update({ contract: contract ?? null })
              .eq("league_slug", LEAGUE_SLUG)
              .eq("owner_slug", owner_slug)
              .eq("wrestler_id", wrestler_id);
            if (updateError) {
              return NextResponse.json(
                { error: updateError.message, hint: "Table may need RLS policies allowing update." },
                { status: 500 }
              );
            }
          } else {
            return NextResponse.json(
              { error: insertError.message, hint: "Ensure roster_assignments table exists (see supabase/roster_assignments.sql). Enable insert for anon/authenticated if using RLS." },
              { status: 500 }
            );
          }
        }
      } else {
        return NextResponse.json(
          { error: upsertError.message, hint: "Ensure roster_assignments table exists (see supabase/roster_assignments.sql). If using RLS, add policies for insert/update." },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ ok: true, action: "set" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
