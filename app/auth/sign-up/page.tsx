import Link from "next/link";
import { AuthForm } from "../AuthForm";

export const metadata = {
  title: "Sign up — Draftastic Fantasy",
  description: "Create an account",
};

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
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
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Sign up</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Create an account with email and password, or use Google.
      </p>
      <AuthForm mode="sign-up" searchParams={searchParams} />
      <p style={{ marginTop: 20, fontSize: 15, color: "#555" }}>
        Already have an account?{" "}
        <Link href="/auth/sign-in" style={{ color: "#1a73e8" }}>
          Sign in
        </Link>
      </p>
    </main>
  );
}
