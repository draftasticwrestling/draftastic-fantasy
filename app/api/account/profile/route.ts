import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import {
  getAvatarDisplayUrl,
  resolveAllowedAvatarFromUrl,
  userMayUseAvatar,
} from "@/lib/avatarCatalog";
import { isProfileManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import { syncMarketingOptInToConstantContact } from "@/lib/constantContactSync";
import { validateProfileDisplayName } from "@/lib/profileDisplayName";
import { validateProfileTimezone } from "@/lib/profileTimezone";

/**
 * PATCH /api/account/profile — update current user's profile (display_name, etc.)
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getServerAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseOrigin =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

    const body = await request.json() as Record<string, unknown>;
    let shouldSyncMarketing = false;
    const nowIso = new Date().toISOString();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("timezone, needs_avatar_selection, is_site_admin")
      .eq("id", user.id)
      .maybeSingle();
    const currentTz = ((existingProfile as { timezone?: string | null } | null)?.timezone ?? "").trim();
    const mustSelectAvatar =
      Boolean(
        (existingProfile as { needs_avatar_selection?: boolean | null } | null)?.needs_avatar_selection
      ) &&
      !Boolean((existingProfile as { is_site_admin?: boolean | null } | null)?.is_site_admin);

    const updates: Record<string, unknown> = {
      updated_at: nowIso,
      last_activity_at: nowIso,
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
      const tzCheck = validateProfileTimezone(typeof body.timezone === "string" ? body.timezone : null);
      if (!tzCheck.ok) {
        return NextResponse.json({ error: tzCheck.error }, { status: 400 });
      }
      updates.timezone = tzCheck.value;
    }
    if (typeof body.notify_trade_proposals === "boolean") {
      updates.notify_trade_proposals = body.notify_trade_proposals;
    }
    if (typeof body.notify_trade_accepted === "boolean") {
      updates.notify_trade_accepted = body.notify_trade_accepted;
    }
    if (typeof body.notify_trade_finalized === "boolean") {
      updates.notify_trade_finalized = body.notify_trade_finalized;
    }
    if (typeof body.notify_gm_trade_approval === "boolean") {
      updates.notify_gm_trade_approval = body.notify_gm_trade_approval;
    }
    if (typeof body.notify_event_scores === "boolean") {
      updates.notify_event_scores = body.notify_event_scores;
    }
    if (typeof body.notify_draft_reminder === "boolean") {
      updates.notify_draft_reminder = body.notify_draft_reminder;
    }
    if (typeof body.notify_weekly_results === "boolean") {
      updates.notify_weekly_results = body.notify_weekly_results;
    }
    if (typeof body.marketing_opt_in === "boolean") {
      updates.marketing_opt_in = body.marketing_opt_in;
      updates.marketing_opt_in_at = body.marketing_opt_in ? nowIso : null;
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

    if (Object.prototype.hasOwnProperty.call(body, "avatar_id")) {
      const raw = body.avatar_id;
      if (raw === null) {
        if (mustSelectAvatar) {
          return NextResponse.json(
            { error: "Choose a manager avatar from the starter pack to continue." },
            { status: 400 }
          );
        }
        updates.avatar_id = null;
        updates.avatar_url = null;
      } else if (typeof raw === "string") {
        const avatarId = raw.trim();
        if (!avatarId) {
          if (mustSelectAvatar) {
            return NextResponse.json(
              { error: "Choose a manager avatar from the starter pack to continue." },
              { status: 400 }
            );
          }
          updates.avatar_id = null;
          updates.avatar_url = null;
        } else if (!(await userMayUseAvatar(user.id, avatarId))) {
          return NextResponse.json(
            { error: "That avatar is not available on your account." },
            { status: 400 }
          );
        } else {
          const displayUrl = await getAvatarDisplayUrl(avatarId);
          if (!displayUrl) {
            return NextResponse.json({ error: "Avatar asset not found." }, { status: 400 });
          }
          updates.avatar_id = avatarId;
          updates.avatar_url = displayUrl;
          updates.needs_avatar_selection = false;
        }
      }
    } else if (Object.prototype.hasOwnProperty.call(body, "avatar_url")) {
      const raw = body.avatar_url;
      if (raw === null) {
        if (mustSelectAvatar) {
          return NextResponse.json(
            { error: "Choose a manager avatar from the starter pack to continue." },
            { status: 400 }
          );
        }
        updates.avatar_url = null;
        updates.avatar_id = null;
      } else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) {
          if (mustSelectAvatar) {
            return NextResponse.json(
              { error: "Choose a manager avatar from the starter pack to continue." },
              { status: 400 }
            );
          }
          updates.avatar_url = null;
          updates.avatar_id = null;
        } else if (isProfileManagerAvatarUrl(t, user.id, supabaseOrigin)) {
          updates.avatar_url = t;
          const match = await resolveAllowedAvatarFromUrl(user.id, t);
          if (mustSelectAvatar && !match?.id) {
            return NextResponse.json(
              { error: "Choose a manager avatar from the starter pack to continue." },
              { status: 400 }
            );
          }
          updates.avatar_id = match?.id ?? null;
          if (match?.id) {
            updates.needs_avatar_selection = false;
          }
        } else {
          return NextResponse.json(
            { error: "Invalid avatar URL. Upload a manager avatar from this site or clear it." },
            { status: 400 }
          );
        }
      }
    }

    const effectiveTimezone =
      updates.timezone !== undefined ? String(updates.timezone ?? "").trim() : currentTz;
    if (!effectiveTimezone) {
      return NextResponse.json(
        { error: "Timezone is required. Choose your timezone and save, then you can update other profile fields." },
        { status: 400 }
      );
    }

    let { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (
      error &&
      /(marketing_opt_in|notify_trade_accepted|notify_trade_finalized|notify_gm_trade_approval|notify_event_scores|avatar_id|needs_avatar_selection)/i.test(
        error.message ?? ""
      )
    ) {
      delete updates.marketing_opt_in;
      delete updates.marketing_opt_in_at;
      delete updates.marketing_opt_in_source;
      delete updates.notify_trade_accepted;
      delete updates.notify_trade_finalized;
      delete updates.notify_gm_trade_approval;
      delete updates.notify_event_scores;
      delete updates.avatar_id;
      delete updates.needs_avatar_selection;
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
