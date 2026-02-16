import { EXAMPLE_LEAGUE, LEAGUE_MEMBERS } from "@/lib/league";
import RosterManager from "../RosterManager";
import { getDraftPicksByOwner, getPickLabel, DEFAULT_SEASON } from "@/lib/draftPicks";

export const metadata = {
  title: `Draft — ${EXAMPLE_LEAGUE.name} — Draftastic Fantasy`,
  description: "Assign wrestlers to owners and set contract lengths.",
};

export default async function LeagueDraftPage() {
  const draftPicksByOwner = await getDraftPicksByOwner(EXAMPLE_LEAGUE.slug, DEFAULT_SEASON);

  return (
    <>
      <h1 style={{ marginBottom: 8 }}>Draft assignment</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Assign wrestlers to owners and set contract lengths. Season {DEFAULT_SEASON} draft picks (round + discovery) are shown below for reference.
      </p>

      <RosterManager />

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Season {DEFAULT_SEASON} draft picks</h2>
        <p style={{ color: "#555", marginBottom: 16, fontSize: 15 }}>
          R1-2: 3 yr, R3-4: 2 yr, R5-6: 1 yr. Discovery 1: 3 yr, 2: 2 yr, 3: 1 yr.
        </p>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {LEAGUE_MEMBERS.map((member) => {
            const picks = draftPicksByOwner[member.slug] ?? [];
            const labels = picks.map((p) => getPickLabel(p)).join(", ");
            return (
              <li key={member.slug} style={{ padding: "8px 0", borderBottom: "1px solid #eee", fontSize: 15 }}>
                <strong>{member.name}</strong>: {labels || "—"}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
