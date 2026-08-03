import Link from "next/link";

/** Prompt members of existing Road to War Games leagues to set draft prefs now that Big Boards are ready. */
export function R2wgDraftPrefsCallout({ leagueSlug }: { leagueSlug: string }) {
  return (
    <div className="league-onboarding-callout" style={{ marginBottom: 24 }} role="status">
      <p style={{ margin: 0 }}>
        <strong>Set your draft preferences.</strong> Big Boards are ready for Road to War Games — pick a provided
        board or build your own list before the GM begins the draft. If you skip this, the Default Big Board is used.{" "}
        <Link href={`/leagues/${encodeURIComponent(leagueSlug)}/draft/preferences`} className="app-link">
          Set draft preferences →
        </Link>
      </p>
    </div>
  );
}
