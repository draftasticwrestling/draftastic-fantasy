"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseAuthErrorMessage } from "@/lib/authUserFacingErrors";
import { PLAY_PATH } from "@/lib/playFunnel";

type Mode = "sign-in" | "sign-up";

type Props = {
  mode: Mode;
  searchParams: Promise<{ error?: string; next?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  callback: "Sign-in was interrupted. Please try again.",
  "reset-success": "Password updated. Sign in with your new password.",
  default: "Something went wrong. Please try again.",
};

export function AuthForm({ mode, searchParams }: Props) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ error?: string; next?: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    searchParams.then(setResolvedParams);
  }, [searchParams]);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      // Browser may not support IANA timezone resolution.
    }
  }, []);

  const next = resolvedParams?.next ?? (mode === "sign-up" ? PLAY_PATH : "/");
  const errorFromUrl = resolvedParams?.error ? ERROR_MESSAGES[resolvedParams.error] ?? resolvedParams.error : null;

  const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const emailNorm = normalizeEmail(email);
    if (!emailNorm || !password) {
      setMessage({ type: "err", text: "Enter your email and password." });
      return;
    }
    if (mode === "sign-up" && !displayName.trim()) {
      setMessage({ type: "err", text: "Enter a display name." });
      return;
    }
    if (mode === "sign-up" && !acceptedTerms) {
      setMessage({ type: "err", text: "You must accept the Terms and Privacy Policy." });
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email: emailNorm, password });
        if (error) {
          let text = mapSupabaseAuthErrorMessage(error.message);
          if (/email not confirmed|confirm your email|not verified/i.test(error.message)) {
            text =
              "Confirm your email before signing in. Check your inbox and spam for the confirmation link. If you never received it, try signing up again or use Forgot password (works after the account exists).";
          }
          setMessage({ type: "err", text });
          return;
        }
      } else {
        const acceptedAt = new Date().toISOString();
        const params = new URLSearchParams({ next });
        params.set("signup", "1");
        params.set("dn", displayName.trim());
        if (timezone) params.set("tz", timezone);
        params.set("ta", acceptedAt);
        if (marketingOptIn) params.set("mo", "1");
        const { error } = await supabase.auth.signUp({
          email: emailNorm,
          password,
          options: {
            data: {
              display_name: displayName.trim(),
              timezone: timezone || null,
              accepted_terms_at: acceptedAt,
              accepted_privacy_at: acceptedAt,
              marketing_opt_in: marketingOptIn,
              marketing_opt_in_at: marketingOptIn ? acceptedAt : null,
              marketing_opt_in_source: marketingOptIn ? "signup_email" : null,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?${params.toString()}`,
          },
        });
        if (error) {
          setMessage({ type: "err", text: mapSupabaseAuthErrorMessage(error.message) });
          return;
        }
        setMessage({
          type: "ok",
          text: "Check your email for a confirmation link, then sign in.",
        });
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: ERROR_MESSAGES.default });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    if (mode === "sign-up" && !displayName.trim()) {
      setMessage({ type: "err", text: "Enter a display name." });
      return;
    }
    if (mode === "sign-up" && !acceptedTerms) {
      setMessage({ type: "err", text: "You must accept the Terms and Privacy Policy." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const params = new URLSearchParams({ next });
    if (mode === "sign-up") {
      const acceptedAt = new Date().toISOString();
      params.set("signup", "1");
      params.set("dn", displayName.trim());
      if (timezone) params.set("tz", timezone);
      params.set("ta", acceptedAt);
      if (marketingOptIn) params.set("mo", "1");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params.toString()}`,
      },
    });
    if (error) {
      setMessage({ type: "err", text: mapSupabaseAuthErrorMessage(error.message) });
      setLoading(false);
      return;
    }
    // OAuth redirects the page; no need to router.push
  };

  return (
    <>
      {errorFromUrl && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {errorFromUrl}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 16,
            fontWeight: 600,
            border: "1px solid #dadce0",
            borderRadius: 8,
            background: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {mode === "sign-in" ? "Sign in with Google" : "Sign up with Google"}
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: 16, color: "#888", fontSize: 14 }}>
        or
      </div>

      <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mode === "sign-up" && (
          <div>
            <label htmlFor="auth-display-name" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
              Display name
            </label>
            <input
              id="auth-display-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you appear in leagues"
              maxLength={100}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 16,
                border: "1px solid #ccc",
                borderRadius: 6,
                boxSizing: "border-box",
              }}
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label htmlFor="auth-password" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </div>
        {mode === "sign-up" && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#444", cursor: "pointer" }}>
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#1a73e8" }}>
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#1a73e8" }}>
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        )}
        {mode === "sign-up" && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#444", cursor: "pointer" }}>
            <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
            <span>
              Email me product updates, new league openings, and beta announcements. You can unsubscribe anytime.
            </span>
          </label>
        )}
        {message && (
          <p style={{ margin: 0, color: message.type === "err" ? "#b91c1c" : "#166534", fontSize: 14 }}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 16px",
            fontSize: 16,
            fontWeight: 600,
            border: "none",
            borderRadius: 8,
            background: "#1a73e8",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
      </form>

      {mode === "sign-in" && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          <Link href="/auth/forgot-password" style={{ color: "#1a73e8" }}>
            Forgot password?
          </Link>
        </p>
      )}
    </>
  );
}
