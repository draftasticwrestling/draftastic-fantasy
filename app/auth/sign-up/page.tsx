import Link from "next/link";
import { AuthForm } from "../AuthForm";
import { AuthModeSwitch } from "../AuthModeSwitch";
import { PLAY_PATH } from "@/lib/playFunnel";

export const metadata = {
  title: "Sign up — Draftastic Fantasy",
  description: "Create an account to join or create a league",
};

export default async function SignUpPage({
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
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Sign up</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Create an account to join or create a league. Use email and password (or Google), choose a display name, and
        accept Terms/Privacy.
      </p>
      <AuthForm mode="sign-up" searchParams={searchParams} />
      <AuthModeSwitch mode="sign-up" next={next ?? PLAY_PATH} />
    </main>
  );
}
