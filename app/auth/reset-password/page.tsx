"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setReady(Boolean(user));
      if (!user) {
        setMessage({ type: "err", text: "Reset link is invalid or expired. Request a new password reset email." });
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({ type: "err", text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: "err", text: "Passwords do not match." });
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({ type: "ok", text: "Password updated. Redirecting to sign in…" });
    setTimeout(() => {
      router.push("/auth/sign-in?error=reset-success");
    }, 700);
  };

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 420,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/auth/sign-in" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Sign in
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Set new password</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>Choose a new password for your account.</p>

      {ready === false ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
          {message?.text}
          {" "}
          <Link href="/auth/forgot-password" style={{ color: "#1a73e8" }}>
            Request new link
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="rp-password" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
              New password
            </label>
            <input
              id="rp-password"
              type="password"
              autoComplete="new-password"
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
          <div>
            <label htmlFor="rp-confirm" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
              Confirm new password
            </label>
            <input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
          {message && (
            <p style={{ margin: 0, color: message.type === "err" ? "#b91c1c" : "#166534", fontSize: 14 }}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || ready === null}
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
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}
