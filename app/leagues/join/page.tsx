import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinLeagueForm } from "../JoinLeagueForm";

type Props = { searchParams: Promise<{ token?: string }> };

export const metadata = {
  title: "Join a league — Draftastic Fantasy",
  description: "Join a league with an invite link",
};

export default async function JoinLeaguePage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { token } = await searchParams;

  if (!user) {
    const next = token ? `/leagues/join?token=${encodeURIComponent(token)}` : "/leagues/join";
    redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 480,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← My leagues
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Join a league</h1>
      {token ? (
        <>
          <p style={{ color: "#555", marginBottom: 24 }}>
            You’re invited to join a league. Click below to join.
          </p>
          <JoinLeagueForm token={token} />
        </>
      ) : (
        <p style={{ color: "#555" }}>
          Use the invite link you received. It should look like: …/leagues/join?token=…
        </p>
      )}
    </main>
  );
}
