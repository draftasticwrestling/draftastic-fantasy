"use client";

type Props = {
  leagueSlug: string;
  isSalaryCapLeague?: boolean;
};

export function GmToolsNav({ leagueSlug, isSalaryCapLeague = false }: Props) {
  const base = `/leagues/${leagueSlug}`;
  return (
    <div style={{ marginBottom: 20, maxWidth: 320 }}>
      <label
        htmlFor="gm-tools-nav"
        style={{ display: "block", fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}
      >
        GM Tools
      </label>
      <select
        id="gm-tools-nav"
        defaultValue={`${base}/league-settings`}
        onChange={(e) => {
          if (!e.currentTarget.value) return;
          window.location.href = e.currentTarget.value;
        }}
        style={{
          width: "100%",
          padding: "9px 12px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-bg-input)",
          color: "var(--color-text)",
        }}
      >
        <option value={`${base}/league-settings`}>League Settings</option>
        {!isSalaryCapLeague ? (
          <>
            <option value={`${base}/manage-rosters`}>Manage Rosters</option>
            <option value={`${base}/pending-trades`}>Pending Transactions</option>
          </>
        ) : null}
        <option value={`${base}/notify-league`}>Notify League</option>
      </select>
    </div>
  );
}
