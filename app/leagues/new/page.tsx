import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateLeagueForm } from "../CreateLeagueForm";

export const metadata = {
  title: "Create a Private League — Draftastic Fantasy",
  description: "Create an MVL Private League — season-only rosters, no long-term contracts",
};

export default async function NewLeaguePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in?next=/leagues/new");
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
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Create a Private League</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        You’ll be the commissioner. Add a name and optional dates (e.g. season window).
      </p>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Standard seasons: <strong>Road to SummerSlam</strong> (first Raw in May → SummerSlam Night 2), <strong>Road to Survivor Series</strong> (first Raw in August → Survivor Series), <strong>Road to WrestleMania</strong> (first Raw in December → WrestleMania Night 2), <strong>Chamber to Mania</strong> (Elimination Chamber → WrestleMania Night 2, beta test). Leagues have 3–12 teams; roster size depends on how many join (see league page after creation).
      </p>
      <CreateLeagueForm />
    </main>
  );
}
