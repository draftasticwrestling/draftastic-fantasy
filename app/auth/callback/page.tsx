"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeRelativeNext } from "@/lib/auth/oauthCallbackNext";

function readCallbackIntent(origin: string) {
  const url = new URL(window.location.href);
  const nextRaw = url.searchParams.get("next") ?? "/";
  return {
    next: sanitizeRelativeNext(nextRaw.startsWith("/") ? nextRaw : "/", origin),
    isSignup: url.searchParams.get("signup") === "1",
    isRecovery: url.searchParams.get("flow") === "recovery",
    displayName: url.searchParams.get("dn")?.trim() ?? "",
    timezone: url.searchParams.get("tz")?.trim() ?? "",
    acceptedAt: url.searchParams.get("ta")?.trim() ?? "",
    marketingOptIn: url.searchParams.get("mo") === "1",
  };
}

function hasAuthPayload(url: URL): boolean {
  if (url.searchParams.get("code")) return true;
  if (url.searchParams.get("token_hash") && url.searchParams.get("type")) return true;
  if (typeof window !== "undefined" && window.location.hash && window.location.hash.length > 1) return true;
  return false;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [hint, setHint] = useState("Completing sign-in…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const origin = url.origin;
      const intent = readCallbackIntent(origin);

      if (!hasAuthPayload(url)) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          router.replace(intent.next);
          router.refresh();
        } else {
          router.replace("/auth/sign-in?error=callback");
        }
        return;
      }

      const code = url.searchParams.get("code");
      const token_hash = url.searchParams.get("token_hash");
      const otpType = url.searchParams.get("type");
      let authErr: { message: string } | null = null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) authErr = error;
        }
      } else if (token_hash && otpType) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: otpType as
            | "signup"
            | "email"
            | "recovery"
            | "magiclink"
            | "invite"
            | "email_change",
        });
        if (error) authErr = error;
      } else if (window.location.hash.length > 1) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) authErr = error;
        } else {
          authErr = { message: "Missing tokens in link." };
        }
      }

      if (cancelled) return;

      if (authErr) {
        console.error("Auth callback:", authErr.message);
        setHint("Something went wrong. Redirecting…");
        const fail = intent.isRecovery ? "/auth/forgot-password?error=callback" : "/auth/sign-in?error=callback";
        router.replace(fail);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/sign-in?error=callback");
        return;
      }

      if (intent.isSignup) {
        setHint("Saving your profile…");
        const res = await fetch("/api/auth/complete-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            displayName: intent.displayName,
            timezone: intent.timezone,
            acceptedAt: intent.acceptedAt,
            marketingOptIn: intent.marketingOptIn,
          }),
        });
        if (!res.ok) {
          console.error("complete-signup:", await res.text().catch(() => ""));
        }
      }

      router.replace(intent.next);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 420,
        margin: "48px auto",
        fontSize: 16,
        color: "#444",
      }}
    >
      <p style={{ margin: 0 }}>{hint}</p>
    </main>
  );
}
