import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isProfileManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import { syncMarketingOptInToConstantContact } from "@/lib/constantContactSync";
import { validateProfileDisplayName } from "@/lib/profileDisplayName";

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

    const supabaseOrigin =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

    const body = await request.json() as Record<string, unknown>;
    let shouldSyncMarketing = false;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("display_name" in body) {
      const checked = validateProfileDisplayName(
        typeof body.display_name === "string" ? body.display_name : null
      );
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: 400 });
      }
      updates.display_name = checked.value;
    }
    if ("timezone" in body) {
      updates.timezone =
        typeof body.timezone === "string" ? body.timezone.trim() || null : null;
    }
    if (typeof body.notify_trade_proposals === "boolean") {
      updates.notify_trade_proposals = body.notify_trade_proposals;
    }
    if (typeof body.notify_draft_reminder === "boolean") {
      updates.notify_draft_reminder = body.notify_draft_reminder;
    }
    if (typeof body.notify_weekly_results === "boolean") {
      updates.notify_weekly_results = body.notify_weekly_results;
    }
    if (typeof body.marketing_opt_in === "boolean") {
      updates.marketing_opt_in = body.marketing_opt_in;
      updates.marketing_opt_in_at = body.marketing_opt_in ? new Date().toISOString() : null;
      updates.marketing_opt_in_source = body.marketing_opt_in ? "account_settings" : null;
      shouldSyncMarketing = body.marketing_opt_in;
    }
    if ("accepted_terms_at" in body) {
      updates.accepted_terms_at =
        typeof body.accepted_terms_at === "string" ? body.accepted_terms_at : null;
    }
    if ("accepted_privacy_at" in body) {
      updates.accepted_privacy_at =
        typeof body.accepted_privacy_at === "string" ? body.accepted_privacy_at : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "avatar_url")) {
      const raw = body.avatar_url;
      if (raw === null) {
        updates.avatar_url = null;
      } else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) {
          updates.avatar_url = null;
        } else if (isProfileManagerAvatarUrl(t, user.id, supabaseOrigin)) {
          updates.avatar_url = t;
        } else {
          return NextResponse.json(
            { error: "Invalid avatar URL. Upload a manager avatar from this site or clear it." },
            { status: 400 }
          );
        }
      }
    }

    let { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (error && /marketing_opt_in/i.test(error.message ?? "")) {
      delete updates.marketing_opt_in;
      delete updates.marketing_opt_in_at;
      delete updates.marketing_opt_in_source;
      const fallback = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (shouldSyncMarketing && user.email) {
      const sync = await syncMarketingOptInToConstantContact({
        email: user.email,
        firstName: typeof body.display_name === "string" ? body.display_name : null,
        source: "account_settings",
      });
      if (!sync.ok && !sync.skipped) {
        console.warn("Constant Contact account-settings sync failed:", sync.reason);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
