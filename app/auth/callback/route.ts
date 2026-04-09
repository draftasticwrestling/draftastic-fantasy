import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback: Supabase redirects here after sign-in with Google (or other provider).
 * We exchange the code for a session and set cookies, then redirect home.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next") ?? "/";
  const isSignup = requestUrl.searchParams.get("signup") === "1";
  const isRecovery = requestUrl.searchParams.get("flow") === "recovery";
  const displayName = requestUrl.searchParams.get("dn")?.trim() ?? "";
  const timezone = requestUrl.searchParams.get("tz")?.trim() ?? "";
  const acceptedAt = requestUrl.searchParams.get("ta")?.trim() ?? "";
  const next = nextRaw.startsWith("/") ? nextRaw : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Auth callback exchange error:", error.message);
      const failPath = isRecovery ? "/auth/forgot-password?error=callback" : "/auth/sign-in?error=callback";
      return NextResponse.redirect(new URL(failPath, requestUrl.origin));
    }
    if (isSignup) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            display_name: displayName || null,
            timezone: timezone || null,
            accepted_terms_at: acceptedAt || null,
            accepted_privacy_at: acceptedAt || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
