"use client";

import { useState } from "react";
import Link from "next/link";

export type DraftPickRow = {
  overall_pick: number;
  user_id: string;
  wrestler_id: string;
  wrestler_name: string | null;
  picked_at: string;
  is_auto_pick?: boolean;
};

export type MemberRow = {
  user_id: string;
  display_name?: string | null;
  team_name?: string | null;
};

type DraftOption = { id: string; label: string };

type Props = {
  leagueSlug: string;
  leagueName: string;
  draftOptions: DraftOption[];
  picks: DraftPickRow[];
  members: MemberRow[];
};

function teamLabel(m: MemberRow): string {
  const name = m.team_name?.trim() || m.display_name?.trim();
  return name || "Unknown";
}

export function DraftHistoryView({
  leagueSlug,
  leagueName,
  draftOptions,
  picks,
  members,
}: Props) {
  const [selectedDraftId, setSelectedDraftId] = useState(draftOptions[0]?.id ?? "");
  const [viewFilter, setViewFilter] = useState<"full" | string>("full"); // "full" or user_id for team

  const filteredPicks =
    viewFilter === "full"
      ? picks
      : picks.filter((p) => p.user_id === viewFilter);

  const selectedDraft = draftOptions.find((d) => d.id === selectedDraftId) ?? draftOptions[0];

  return (
    <div style={{ maxWidth: 800 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${leagueSlug}`} className="app-link">
          ← {leagueName}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Draft History</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14 }}>
        View draft results for this league. Switch by year or season to see past drafts, or filter by team to see one team&apos;s picks.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        {draftOptions.length > 1 ? (
          <div>
            <label htmlFor="draft-select" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--color-text-muted)" }}>
              Draft
            </label>
            <select
              id="draft-select"
              value={selectedDraftId}
              onChange={(e) => setSelectedDraftId(e.target.value)}
              className="app-input"
              style={{ minWidth: 220 }}
            >
              {draftOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        ) : draftOptions.length === 1 ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-text)" }}>Draft:</strong> {selectedDraft?.label}
          </p>
        ) : null}

        <div>
          <label htmlFor="view-select" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--color-text-muted)" }}>
            View
          </label>
          <select
            id="view-select"
            value={viewFilter}
            onChange={(e) => setViewFilter(e.target.value)}
            className="app-input"
            style={{ minWidth: 200 }}
          >
            <option value="full">Full draft</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {teamLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredPicks.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", padding: 24, background: "var(--color-bg-elevated)", borderRadius: "var(--radius)" }}>
          {picks.length === 0
            ? "No draft results yet. Complete the draft to see results here."
            : "No picks for this team in this draft."}
        </p>
      ) : (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-bg-surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Pick</th>
                {viewFilter === "full" && (
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Team</th>
                )}
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Wrestler</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredPicks.map((pick) => {
                const member = members.find((m) => m.user_id === pick.user_id);
                return (
                  <tr
                    key={pick.overall_pick}
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontWeight: 600 }}>
                      #{pick.overall_pick}
                    </td>
                    {viewFilter === "full" && (
                      <td style={{ padding: "10px 12px" }}>{member ? teamLabel(member) : "—"}</td>
                    )}
                    <td style={{ padding: "10px 12px" }}>
                      <Link href={`/wrestlers/${encodeURIComponent(pick.wrestler_id)}`} className="app-link">
                        {pick.wrestler_name || pick.wrestler_id}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontSize: 12 }}>
                      {pick.is_auto_pick ? "Auto-pick" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
