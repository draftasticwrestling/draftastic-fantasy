"use client";

const TABLE_LEGEND_ITEMS: { abbr: string; full: string }[] = [
  { abbr: "Roster", full: "Brand/show (Raw, SmackDown, NXT, etc.)" },
  { abbr: "Rank", full: "Standing by total points in this view" },
  { abbr: "Titles", full: "Current championship(s)" },
  { abbr: "Faction", full: "Faction name (manager’s roster) or Free Agent (FA)" },
  { abbr: "Gender", full: "Male / Female" },
  { abbr: "Age", full: "Age in years" },
  { abbr: "2K", full: "WWE 2K game rating (from Pro Wrestling Boxscore)" },
  { abbr: "R/S", full: "Points from Raw & SmackDown" },
  { abbr: "PLE", full: "Points from Premium Live Events" },
  { abbr: "Belt", full: "Title/championship points" },
  { abbr: "TOT", full: "Total fantasy points (R/S + PLE + Belt)" },
  { abbr: "PPM", full: "Points per match" },
  { abbr: "MW", full: "Matches wrestled" },
  { abbr: "Win", full: "Match wins" },
  { abbr: "W%", full: "Win percentage" },
  { abbr: "Loss", full: "Match losses" },
  { abbr: "L%", full: "Loss percentage" },
  { abbr: "NC", full: "No contest" },
  { abbr: "DQW", full: "Wins via disqualification" },
  { abbr: "DQL", full: "Losses via disqualification" },
  { abbr: "DQ%", full: "Share of matches that ended in DQ" },
];

const CARD_LEGEND_ITEMS: { abbr: string; full: string }[] = [
  { abbr: "R/S", full: "Raw & SmackDown points" },
  { abbr: "PLE", full: "Premium Live Event points" },
  { abbr: "BELT", full: "Title/championship points" },
  { abbr: "PPM", full: "Points per match" },
  { abbr: "TOTAL POINTS", full: "R/S + PLE + Belt" },
];

const glossaryTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  marginBottom: 10,
  color: "var(--color-text, #1a1a1a)",
};

const glossaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "6px 24px",
  margin: 0,
  padding: 0,
  listStyle: "none",
  fontSize: 12,
  color: "var(--color-text-muted, #555)",
  lineHeight: 1.6,
};

const glossaryItemStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "baseline",
};

const glossarySectionStyle: React.CSSProperties = {
  marginTop: 24,
  padding: "14px 18px",
  background: "var(--color-bg-elevated, #f8f9fa)",
  borderRadius: 8,
  border: "1px solid var(--color-border, #e9ecef)",
};

/** Glossary at the bottom of the full wrestler data table (League Leaders, Free Agents, Wrestlers list). */
export function WrestlerTableLegend() {
  return (
    <section style={glossarySectionStyle} aria-label="Glossary">
      <h3 style={glossaryTitleStyle}>Glossary</h3>
      <ul style={glossaryGridStyle}>
        {TABLE_LEGEND_ITEMS.map(({ abbr, full }) => (
          <li key={abbr} style={glossaryItemStyle}>
            <strong style={{ color: "var(--color-text, #1a1a1a)", fontWeight: 600 }}>{abbr}:</strong>
            <span>{full}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Glossary at the bottom of the roster card grid. */
export function WrestlerCardLegend() {
  return (
    <section style={glossarySectionStyle} aria-label="Glossary">
      <h3 style={glossaryTitleStyle}>Glossary</h3>
      <ul style={{ ...glossaryGridStyle, gridTemplateColumns: "repeat(2, 1fr)" }}>
        {CARD_LEGEND_ITEMS.map(({ abbr, full }) => (
          <li key={abbr} style={glossaryItemStyle}>
            <strong style={{ color: "var(--color-text, #1a1a1a)", fontWeight: 600 }}>{abbr}:</strong>
            <span>{full}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
