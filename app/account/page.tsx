import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getProfile } from "@/lib/profiles";
import { AccountAvatarField } from "./AccountAvatarField";
import { AccountForm } from "./AccountForm";
import { AccountXpSection } from "./AccountXpSection";

export const metadata = {
  title: "Account — Draftastic Fantasy",
  description: "Manage your profile and account settings",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string; required?: string }>;
}) {
  const { suspended, required } = await searchParams;
  const { supabase, user } = await getServerAuth();
  if (!user) {
    redirect("/auth/sign-in?next=/account");
  }

  const profile = await getProfile(user.id);
  const needsRequiredAccount =
    !(profile?.display_name ?? "").trim() ||
    !profile?.accepted_terms_at ||
    !profile?.accepted_privacy_at;
  const needsTimezone = !(profile?.timezone ?? "").trim();
  const needsRequiredProfile = needsRequiredAccount || needsTimezone;

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
      {suspended === "1" ? (
        <p
          style={{
            color: "#991b1b",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 16,
          }}
        >
          Your account is currently suspended from protected areas. Contact draftasticwrestling@gmail.com if you believe this is a
          mistake.
        </p>
      ) : null}
      {needsRequiredProfile ? (
        <p
          style={{
            color: "#92400e",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 16,
          }}
        >
          {required === "1" ? (
            <>
              <strong>Finish your profile to continue.</strong>{" "}
            </>
          ) : null}
          {needsRequiredAccount
            ? "Complete display name and accept the Terms and Privacy Policy. "
            : null}
          {needsTimezone ? (
            <>
              <strong>Timezone is required</strong> — choose your region below and click <strong>Save changes</strong>
              (used for draft times and weekly windows).
            </>
          ) : null}
        </p>
      ) : null}
      <p style={{ color: "#555", marginBottom: 24 }}>
        Your display name is shown in the header and will be used in leagues. Your email is not shared with other users.
      </p>
      <AccountXpSection userId={user.id} />
      <AccountForm
        userId={user.id}
        initialDisplayName={profile?.display_name ?? ""}
        initialTimezone={profile?.timezone ?? ""}
        initialNotifyTradeProposals={profile?.notify_trade_proposals ?? true}
        initialNotifyDraftReminder={profile?.notify_draft_reminder ?? true}
        initialNotifyWeeklyResults={profile?.notify_weekly_results ?? true}
        initialMarketingOptIn={profile?.marketing_opt_in ?? false}
        initialAcceptedTermsAt={profile?.accepted_terms_at ?? null}
        initialAcceptedPrivacyAt={profile?.accepted_privacy_at ?? null}
        email={user.email ?? ""}
      />
      <AccountAvatarField
        initialAvatarUrl={profile?.avatar_url ?? null}
        displayNameForInitial={profile?.display_name ?? ""}
      />
    </main>
  );
}
