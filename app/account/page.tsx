import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { AccountForm } from "./AccountForm";

export const metadata = {
  title: "Account — Draftastic Fantasy",
  description: "Manage your profile and account settings",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in?next=/account");
  }

  const profile = await getProfile(user.id);

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
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Account</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Your display name is shown in the header and will be used in leagues. Your email is not shared with other users.
      </p>
      <AccountForm
        userId={user.id}
        initialDisplayName={profile?.display_name ?? ""}
        initialTimezone={profile?.timezone ?? ""}
        initialNotifyTradeProposals={profile?.notify_trade_proposals ?? true}
        initialNotifyDraftReminder={profile?.notify_draft_reminder ?? true}
        initialNotifyWeeklyResults={profile?.notify_weekly_results ?? true}
        email={user.email ?? ""}
      />
    </main>
  );
}
