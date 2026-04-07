import HubLatestEventPreview from "@/app/components/HubLatestEventPreview";
import type { HubPreviewEventRow } from "@/lib/home/hubHomeEvents";
import type { LeagueEventDayCondensedItem, LeagueEventDayRow } from "@/lib/league/eventDayRosterMatches";

const DEFAULT_SECTION_TITLE = "Today's card & your roster";
const DEFAULT_NO_OVERLAP =
  "None of your roster wrestlers are on the announced matches for this show (promos and TBD segments are not listed).";

export function LeagueEventDayRosterCard({
  todayLabelEt,
  items,
  wrestlerRows,
  sectionTitle = DEFAULT_SECTION_TITLE,
  noRosterOverlapCopy = DEFAULT_NO_OVERLAP,
}: {
  todayLabelEt: string;
  items: LeagueEventDayCondensedItem[];
  wrestlerRows: { id: string; name: string | null; image_url: string | null }[];
  /** e.g. "Today's card & Dillster's wrestlers" when viewing another faction */
  sectionTitle?: string;
  /** Shown inside each event card when this faction has no wrestlers on the announced matches */
  noRosterOverlapCopy?: string;
}) {
  if (items.length === 0) return null;

  const allEventsEmpty = items.every((i) => i.allowedMatchOrders.length === 0);

  return (
    <section className="lm-event-day-condensed" style={{ marginBottom: 24 }}>
      <h2 className="lm-card-title" style={{ marginBottom: 8 }}>
        {sectionTitle}
      </h2>
      <p className="lm-league-meta" style={{ marginTop: 0, marginBottom: 16 }}>
        WWE calendar day (ET): <strong>{todayLabelEt}</strong>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {items.map(({ event, allowedMatchOrders, variant }) => {
          const row: HubPreviewEventRow = {
            id: event.id,
            name: event.name,
            date: event.date,
            location: event.location ?? null,
            matches: event.matches,
            status: event.status,
          };
          return (
            <HubLatestEventPreview
              key={event.id}
              event={row}
              wrestlerRows={wrestlerRows}
              variant={variant}
              allowedMatchOrders={allowedMatchOrders}
              fallbackOverride={noRosterOverlapCopy}
            />
          );
        })}
      </div>
      {allEventsEmpty ? (
        <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.45 }}>
          Card subject to change. Open an event for the full lineup, promos, and live fantasy scoring.
        </p>
      ) : null}
    </section>
  );
}
