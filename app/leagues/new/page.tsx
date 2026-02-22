import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateLeagueForm } from "../CreateLeagueForm";

export const metadata = {
  title: "Create a League — Draftastic Fantasy",
  description: "Create a fantasy pro wrestling league — choose format and invite friends",
};

export default async function NewLeaguePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in?next=/leagues/new");
  }

  return (
    <main className="create-league-page">
      <div className="create-league-card">
        <Link href="/leagues" className="create-league-back">
          ← My leagues
        </Link>
        <h1>Create a League</h1>
        <p style={{ margin: "0 0 24px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          You will be the commissioner. Name your league, set the size and format, then invite your friends.
        </p>
        <CreateLeagueForm />
      </div>
    </main>
  );
}
