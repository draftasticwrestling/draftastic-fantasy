import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { roadToWarGamesCreateOpen } from "@/lib/leagueSeasons";
import { CreateLeagueForm } from "../CreateLeagueForm";

export const metadata = {
  title: "Create a League — Draftastic Fantasy",
  description: "Create a fantasy pro wrestling league — choose format and invite friends",
};

export default async function NewLeaguePage() {
  const { user } = await getServerAuth();
  if (!user) {
    redirect("/auth/sign-in?next=/play?step=create");
  }

  const isSiteAdmin = await getIsSiteAdmin();
  const createOpen = roadToWarGamesCreateOpen();

  return (
    <main className="create-league-page">
      <div className="create-league-card">
        <Link href="/leagues" className="create-league-back">
          ← My leagues
        </Link>
        <h1>Create a League</h1>
        <p style={{ margin: "0 0 24px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          Create a private <strong>Road to War Games</strong> league for friends. Managers join with your league code
          or invite link — no access code needed. Choose Total Season Points (3–6 factions) or Head-to-Head (4–8
          factions); NXT is included.
          {!isSiteAdmin ? (
            <>
              {" "}
              To join a public league instead, use <strong>Play Now</strong> from the home page.
            </>
          ) : (
            <>
              {" "}
              <strong>Site admin:</strong> full create options by default. Use the toggle on the form to preview the
              standard user flow.
            </>
          )}
        </p>
        <CreateLeagueForm isSiteAdmin={isSiteAdmin} createOpen={createOpen} />
      </div>
    </main>
  );
}
