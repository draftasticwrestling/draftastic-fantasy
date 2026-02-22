import type { LeagueMember } from "@/lib/leagues";
import type { LeagueRosterEntry } from "@/lib/leagues";
import type { RosterRules } from "@/lib/leagueStructure";
import { removeRosterEntryFromFormAction } from "./actions";
import { AddRosterForm } from "./AddRosterForm";

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

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                border: "1px solid #eee",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>
                  {member.display_name?.trim() || "Unknown"}
                  {member.role === "commissioner" ? (
                    <span style={{ fontSize: 14, color: "#666", fontWeight: 400 }}> (Commissioner)</span>
                  ) : null}
                </span>
                {rosterRules && (
                  <span style={{ fontSize: 13, color: "#666" }}>
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
              {entries.length === 0 ? (
                <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
                  No wrestlers on roster yet.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {entries.map((e) => (
                    <li
                      key={e.wrestler_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: "1px solid #f0f0f0",
                        gap: 8,
                      }}
                    >
                      <span>{wrestlerName(wrestlers, e.wrestler_id)}</span>
                      {isCommissioner && (
                        <form
                        action={removeRosterEntryFromFormAction}
                        style={{ margin: 0 }}
                      >
                          <input type="hidden" name="leagueSlug" value={leagueSlug} />
                          <input type="hidden" name="leagueId" value={leagueId} />
                          <input type="hidden" name="userId" value={member.user_id} />
                          <input type="hidden" name="wrestlerId" value={e.wrestler_id} />
                          <button
                            type="submit"
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              color: "#c00",
                              background: "none",
                              border: "1px solid #c00",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
