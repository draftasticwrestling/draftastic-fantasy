import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { roadToWrestleManiaCreateStatus } from "@/lib/leagueSeasons";
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
  const createStatus = roadToWrestleManiaCreateStatus();

  return (
    <main className="create-league-page">
      <div className="create-league-card">
        <Link href="/leagues" className="create-league-back">
          ← My leagues
        </Link>
        <h1>Create a League</h1>
        <p style={{ margin: "0 0 24px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          {createStatus !== "open" && !isSiteAdmin ? (
            <>
              Private <strong>Road to WrestleMania</strong> leagues are not open for new creation right now. Join the
              open public league below. You&apos;ll name your faction and build your roster before you are placed.
            </>
          ) : (
            <>
              Create a private <strong>Road to WrestleMania</strong> league for friends. Managers join with your league
              code or invite link — no access code needed. Choose Total Season Points (3–6 factions) or Head-to-Head
              (4–8 factions); NXT is included. The first scored show is the Raw on November 30, 2026, and new leagues
              can start through Monday, March 1, 2027.
              {isSiteAdmin ? (
                <>
                  {" "}
                  <strong>Site admin:</strong> full create options stay available when Standard user view is off.
                </>
              ) : null}
            </>
          )}
        </p>
        <CreateLeagueForm isSiteAdmin={isSiteAdmin} createStatus={createStatus} />
      </div>
    </main>
  );
}
