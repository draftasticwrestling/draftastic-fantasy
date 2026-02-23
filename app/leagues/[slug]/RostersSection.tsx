import type { LeagueMember } from "@/lib/leagues";
import type { LeagueRosterEntry } from "@/lib/leagues";
import type { RosterRules } from "@/lib/leagueStructure";
import { removeRosterEntryFromFormAction } from "./actions";
import { AddRosterForm } from "./AddRosterForm";
import { RosterTable } from "./RosterTable";

type WrestlerOption = { id: string; name: string | null; gender?: string | null };

type Props = {
  leagueId: string;
  leagueSlug: string;
  members: LeagueMember[];
  rosters: Record<string, LeagueRosterEntry[]>;
  wrestlers: WrestlerOption[];
  isCommissioner: boolean;
  rosterRules: RosterRules | null;
  teamCount: number;
};

function wrestlerName(wrestlers: WrestlerOption[], wrestlerId: string): string {
  const w = wrestlers.find(
    (x) => x.id === wrestlerId || x.id.toLowerCase() === wrestlerId.toLowerCase()
  );
  return w?.name ?? wrestlerId;
}

function normalizeGender(g: string | null | undefined): "F" | "M" | null {
  if (g == null || typeof g !== "string") return null;
  const lower = g.trim().toLowerCase();
  if (lower === "female" || lower === "f") return "F";
  if (lower === "male" || lower === "m") return "M";
  return null;
}

function countGender(
  wrestlers: WrestlerOption[],
  wrestlerIds: string[]
): { female: number; male: number } {
  let female = 0;
  let male = 0;
  const byId = new Map(wrestlers.map((w) => [w.id.toLowerCase(), w]));
  for (const id of wrestlerIds) {
    const w = byId.get(id.toLowerCase());
    const g = normalizeGender(w?.gender);
    if (g === "F") female++;
    else if (g === "M") male++;
  }
  return { female, male };
}

export function RostersSection({
  leagueId,
  leagueSlug,
  members,
  rosters,
  wrestlers,
  isCommissioner,
  rosterRules,
  teamCount,
}: Props) {
  const rulesText = rosterRules
    ? `Roster: ${rosterRules.rosterSize} wrestlers (min ${rosterRules.minFemale} female, min ${rosterRules.minMale} male).`
    : teamCount < 3
      ? "League needs at least 3 teams for roster rules to apply."
      : teamCount > 12
        ? "League has more than 12 teams; roster rules apply to 3–12 teams."
        : "Roster rules not defined for this league size.";

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: 12, color: "var(--color-text)" }}>Rosters</h2>
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 8 }}>
        {rulesText}
      </p>
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 16 }}>
        Season-only rosters (no long-term contracts). Commissioner can run a live draft (set type, generate order) or add or remove wrestlers manually.
      </p>

      {isCommissioner && (
        <AddRosterForm
          leagueId={leagueId}
          leagueSlug={leagueSlug}
          members={members}
          wrestlers={wrestlers}
        />
      )}

      <div className="roster-cards-grid">
        {members.map((member) => {
          const entries = rosters[member.user_id] ?? [];
          const ids = entries.map((e) => e.wrestler_id);
          const { female, male } = countGender(wrestlers, ids);
          const isFull = rosterRules && entries.length >= rosterRules.rosterSize;
          const needsGender =
            rosterRules &&
            isFull &&
            (female < rosterRules.minFemale || male < rosterRules.minMale);

          return (
            <div
              key={member.id}
              style={{
                padding: 16,
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                background: "var(--color-bg-surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                  {member.display_name?.trim() || "Unknown"}
                  {member.role === "commissioner" ? (
                    <span style={{ fontSize: 14, color: "var(--color-text-muted)", fontWeight: 400 }}> (Commissioner)</span>
                  ) : null}
                </span>
                {rosterRules && (
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {entries.length}/{rosterRules.rosterSize} ({female}F / {male}M)
                  </span>
                )}
              </div>
              {needsGender && (
                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 13,
                    color: "#b8860b",
                    background: "#fffbe6",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ffe58f",
                  }}
                >
                  Roster is full but needs at least {rosterRules!.minFemale} female and {rosterRules!.minMale} male wrestlers.
                </p>
              )}
              <RosterTable
                entries={entries}
                wrestlerName={(id) => wrestlerName(wrestlers, id)}
                leagueSlug={leagueSlug}
                maxSlots={rosterRules?.rosterSize}
                showRemove={isCommissioner}
                leagueId={leagueId}
                userId={member.user_id}
                removeAction={removeRosterEntryFromFormAction}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
