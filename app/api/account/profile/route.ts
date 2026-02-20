import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/account/profile — update current user's profile (display_name, etc.)
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const display_name =
      typeof body.display_name === "string" ? body.display_name.trim() || null : null;
    const timezone =
      typeof body.timezone === "string" ? body.timezone.trim() || null : null;
    const notify_trade_proposals =
      typeof body.notify_trade_proposals === "boolean" ? body.notify_trade_proposals : undefined;
    const notify_draft_reminder =
      typeof body.notify_draft_reminder === "boolean" ? body.notify_draft_reminder : undefined;
    const notify_weekly_results =
      typeof body.notify_weekly_results === "boolean" ? body.notify_weekly_results : undefined;

    const updates: Record<string, unknown> = {
      display_name,
      updated_at: new Date().toISOString(),
    };
    if (timezone !== undefined) updates.timezone = timezone;
    if (notify_trade_proposals !== undefined) updates.notify_trade_proposals = notify_trade_proposals;
    if (notify_draft_reminder !== undefined) updates.notify_draft_reminder = notify_draft_reminder;
    if (notify_weekly_results !== undefined) updates.notify_weekly_results = notify_weekly_results;

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
