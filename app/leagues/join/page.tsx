import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { JoinLeagueForm } from "../JoinLeagueForm";

type Props = { searchParams: Promise<{ token?: string; code?: string }> };

export const metadata = {
  title: "Join a league — Draftastic Fantasy",
  description: "Join a public league instantly or enter a private league code from your GM",
};

export default async function JoinLeaguePage({ searchParams }: Props) {
  const { user } = await getServerAuth();
  const { token, code } = await searchParams;

  if (!user) {
    const qs = new URLSearchParams();
    if (token) qs.set("token", token);
    if (code) qs.set("code", code);
    const joinPath = qs.toString() ? `/leagues/join?${qs.toString()}` : "/leagues/join";
    redirect(`/auth/sign-in?next=${encodeURIComponent(joinPath)}`);
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
        <>
          <p style={{ color: "#555", marginBottom: 24 }}>
            Join the open public league with one click, or enter a private league code from your GM. Invite links from
            email still work when opened while signed in.
          </p>
          <JoinLeagueForm initialCode={code ?? ""} />
        </>
      )}
    </main>
  );
}
