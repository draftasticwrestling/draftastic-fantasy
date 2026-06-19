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

function safeContinueHref(next: string | undefined): string | null {
  if (!next?.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string; required?: string; avatar_required?: string; next?: string }>;
}) {
  const { suspended, required, avatar_required, next } = await searchParams;
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
  const needsAvatarSelection =
    Boolean(profile?.needs_avatar_selection) && !Boolean(profile?.is_site_admin);
  const avatarRequired = needsAvatarSelection || (avatar_required === "1" && !profile?.is_site_admin);
  const continueHref = safeContinueHref(next);

  const avatarField = (
    <AccountAvatarField
      initialAvatarUrl={profile?.avatar_url ?? null}
      displayNameForInitial={profile?.display_name ?? ""}
      requiredSelection={avatarRequired}
      continueHref={continueHref}
    />
  );

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
      {!avatarRequired ? (
        <p style={{ marginBottom: 24 }}>
          <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
            ← Home
          </Link>
        </p>
      ) : null}
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
      {avatarRequired ? (
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
          <strong>Choose your manager avatar to continue.</strong> Pick a character from the starter pack below
          {continueHref ? " — you will return to where you left off." : "."}
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
      {avatarRequired ? (
        avatarField
      ) : (
        <p style={{ color: "#555", marginBottom: 24 }}>
          Your display name is shown in the header and will be used in leagues. Your email is not shared with other users.
        </p>
      )}
      {!avatarRequired ? <AccountXpSection userId={user.id} /> : null}
      {!avatarRequired ? (
        <AccountForm
          userId={user.id}
          initialDisplayName={profile?.display_name ?? ""}
          initialTimezone={profile?.timezone ?? ""}
          initialNotifyTradeProposals={profile?.notify_trade_proposals ?? true}
          initialNotifyTradeAccepted={profile?.notify_trade_accepted ?? true}
          initialNotifyTradeFinalized={profile?.notify_trade_finalized ?? true}
          initialNotifyGmTradeApproval={profile?.notify_gm_trade_approval ?? true}
          initialNotifyEventScores={profile?.notify_event_scores ?? true}
          initialNotifyDraftReminder={profile?.notify_draft_reminder ?? true}
          initialNotifyWeeklyResults={profile?.notify_weekly_results ?? true}
          initialMarketingOptIn={profile?.marketing_opt_in ?? false}
          initialAcceptedTermsAt={profile?.accepted_terms_at ?? null}
          initialAcceptedPrivacyAt={profile?.accepted_privacy_at ?? null}
          email={user.email ?? ""}
        />
      ) : null}
      {!avatarRequired ? avatarField : null}
    </main>
  );
}
