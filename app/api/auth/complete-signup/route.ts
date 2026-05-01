import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncMarketingOptInToConstantContact } from "@/lib/constantContactSync";

type Body = {
  displayName?: string;
  timezone?: string;
  acceptedAt?: string;
  marketingOptIn?: boolean;
};

/**
 * After email confirmation (or OAuth signup), the browser has a session but profile extras
 * from the signup form live only in callback query params. Client calls this once to persist them.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const displayName = body.displayName?.trim() ?? "";
  const timezone = body.timezone?.trim() ?? "";
  const acceptedAt = body.acceptedAt?.trim() ?? "";
  const marketingOptIn = Boolean(body.marketingOptIn);

  const { error: upsertErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName || null,
      timezone: timezone || null,
      accepted_terms_at: acceptedAt || null,
      accepted_privacy_at: acceptedAt || null,
      marketing_opt_in: marketingOptIn,
      marketing_opt_in_at: marketingOptIn ? acceptedAt || new Date().toISOString() : null,
      marketing_opt_in_source: marketingOptIn ? "signup" : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertErr) {
    console.error("complete-signup profile upsert:", upsertErr.message);
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  if (marketingOptIn && user.email) {
    const sync = await syncMarketingOptInToConstantContact({
      email: user.email,
      firstName: displayName || user.user_metadata?.full_name || null,
      source: "signup",
    });
    if (!sync.ok && !sync.skipped) {
      console.warn("Constant Contact signup sync failed:", sync.reason);
    }
  }

  return NextResponse.json({ ok: true });
}
