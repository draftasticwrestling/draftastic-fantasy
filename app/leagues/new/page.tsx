import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { leagueCreationAccessIsConfigured } from "@/lib/leagueCreationAccess";
import { CreateLeagueForm } from "../CreateLeagueForm";

export const metadata = {
  title: "Create a League — Draftastic Fantasy",
  description: "Create a fantasy pro wrestling league — choose format and invite friends",
};

export default async function NewLeaguePage() {
  const { user } = await getServerAuth();
  if (!user) {
    redirect("/auth/sign-in?next=/leagues/new");
  }

  const requiresAccessCodeEnv = await leagueCreationAccessIsConfigured();
  const isSiteAdmin = await getIsSiteAdmin();

  return (
    <main className="create-league-page">
      <div className="create-league-card">
        <Link href="/leagues" className="create-league-back">
          ← My leagues
        </Link>
        <h1>Create a League</h1>
        <p style={{ margin: "0 0 24px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          Choose private or public. Public league creators become commissioner and public league names are generated
          automatically.
          {requiresAccessCodeEnv && !isSiteAdmin ? (
            <>
              {" "}
              <strong>Beta:</strong> you need the access code from our mailing list to create a league; after
              that, you can invite managers with your league code or invite link.
            </>
          ) : null}
          {isSiteAdmin ? (
            <>
              {" "}
              <strong>Site admin:</strong> full create options by default. Use the toggle on the form to preview the
              standard user flow (mailing-list code and beta limits when enabled).
            </>
          ) : null}
        </p>
        <CreateLeagueForm requiresAccessCodeEnv={requiresAccessCodeEnv} isSiteAdmin={isSiteAdmin} />
      </div>
    </main>
  );
}
