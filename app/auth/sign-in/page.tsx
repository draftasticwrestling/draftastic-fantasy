import Link from "next/link";
import { AuthForm } from "../AuthForm";
import { AuthModeSwitch } from "../AuthModeSwitch";

export const metadata = {
  title: "Sign in — Draftastic Fantasy",
  description: "Sign in to your account",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { next } = await searchParams;

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
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Sign in</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Use your email and password, or sign in with Google.
      </p>
      <AuthForm mode="sign-in" searchParams={searchParams} />
      <AuthModeSwitch mode="sign-in" next={next} />
    </main>
  );
}
