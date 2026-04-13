import Link from "next/link";

import {
  formatEventResultsListMetaLine,
  getEventLogoPath,
  getEventResultsCardTitle,
  getEventShowType,
  type EventShowFilter,
} from "@/lib/boxscore/eventShowHeader";
import type { EventListingRow } from "@/lib/event-results/listingQueries";
import { fetchCompletedEventsPage, fetchUpcomingEventsForListing } from "@/lib/event-results/listingQueries";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { CompletedEventResultsList } from "./CompletedEventResultsList";

import styles from "./event-results.module.css";

export const metadata = {
  title: "WWE Event Results — Draftastic Fantasy",
  description:
    "Raw results, SmackDown results, and WWE premium live event results with box score–style match details. Jump to Raw, SmackDown, or PLE-only listings, then open any show for Draftastic fantasy scoring.",
};

function filterLabel(f: EventShowFilter): string {
  if (f === "raw") return "Raw";
  if (f === "smackdown") return "SmackDown";
  return "PLEs";
}

function buildListingHref(tab: "completed" | "upcoming", show: EventShowFilter | null): string {
  const p = new URLSearchParams();
  if (tab === "upcoming") p.set("tab", "upcoming");
  if (show) p.set("show", show);
  const q = p.toString();
  return q ? `/event-results?${q}` : "/event-results";
}

type Search = { show?: string; tab?: string };

export default async function EventResultsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const showParam = sp?.show;
  const filter: EventShowFilter | null =
    showParam === "raw" || showParam === "smackdown" || showParam === "ple" ? showParam : null;
  const tab: "completed" | "upcoming" = sp?.tab === "upcoming" ? "upcoming" : "completed";

  let completedInitial: EventListingRow[] = [];
  let completedHasMore = false;
  let upcomingRows: EventListingRow[] = [];
  if (tab === "completed") {
    const page = await fetchCompletedEventsPage(0, 50);
    completedInitial = page.events;
    completedHasMore = page.hasMore;
  } else {
    upcomingRows = await fetchUpcomingEventsForListing(80);
  }

  const list =
    tab === "upcoming" && filter ? upcomingRows.filter((e) => getEventShowType(e) === filter) : upcomingRows;

  return (
    <main className={styles.pageRoot}>
      <div className={styles.inner}>
        <div className={styles.backRow}>
          <Link href="/" className={styles.backLink}>
            ← Home
          </Link>
        </div>

        <header className={styles.hero}>
          <h1 className={styles.heroH1}>WWE Event Results</h1>
          <p className={styles.heroBody}>
            Looking for Raw results tonight, SmackDown results tonight, or full WWE results? Pro Wrestling Boxscore tracks
            every Raw, SmackDown, and premium live event with box score–style match details and championship updates—no
            long recaps, just clear, scannable results.
          </p>
          <p className={styles.heroBody}>
            Use the links below to jump to Raw, SmackDown, or PLE-only results, or browse the full list. Each completed
            event opens to a full match card on Draftastic with fantasy scoring; click through for detailed results and
            wrestler context.
          </p>
          <nav className={styles.heroNav} aria-label="Quick show links">
            <Link href={buildListingHref(tab, "raw")}>Raw results</Link>
            <span className={styles.heroNavSep} aria-hidden>
              ·
            </span>
            <Link href={buildListingHref(tab, "smackdown")}>SmackDown results</Link>
            <span className={styles.heroNavSep} aria-hidden>
              ·
            </span>
            <Link href={buildListingHref(tab, "ple")}>PLE results</Link>
          </nav>
        </header>

        <div className={styles.primaryToggleRow}>
          <Link
            href={buildListingHref("completed", filter)}
            className={`${styles.primaryPill} ${tab === "completed" ? styles.primaryPillActive : styles.primaryPillInactive}`}
          >
            Completed Events
          </Link>
          <Link
            href={buildListingHref("upcoming", filter)}
            className={`${styles.primaryPill} ${tab === "upcoming" ? styles.primaryPillActive : styles.primaryPillInactive}`}
          >
            Upcoming Events
          </Link>
        </div>

        <div className={styles.filterRow}>
          <Link
            href={buildListingHref(tab, null)}
            className={`${styles.filterPill} ${filter == null ? styles.filterPillActive : ""}`}
          >
            All
          </Link>
          {(["raw", "smackdown", "ple"] as const).map((key) => (
            <Link
              key={key}
              href={buildListingHref(tab, key)}
              className={`${styles.filterPill} ${filter === key ? styles.filterPillActive : ""}`}
            >
              {filterLabel(key)}
            </Link>
          ))}
        </div>

        {tab === "completed" && completedInitial.length === 0 && (
          <p className={styles.emptyText}>
            No completed events in the list yet. When shows are marked completed on{" "}
            <a href="https://prowrestlingboxscore.com" target="_blank" rel="noopener noreferrer" style={{ color: "#c6a04f" }}>
              prowrestlingboxscore.com
            </a>
            , they appear here with fantasy scoring.
          </p>
        )}

        {tab === "completed" && completedInitial.length > 0 && (
          <CompletedEventResultsList
            initialEvents={completedInitial}
            initialHasMore={completedHasMore}
            showFilter={filter}
          />
        )}

        {tab === "upcoming" && upcomingRows.length === 0 && (
          <p className={styles.emptyText}>
            No upcoming WWE events in the forward window, or upcoming rows are already marked completed.
          </p>
        )}

        {tab === "upcoming" && upcomingRows.length > 0 && filter && list.length > 0 && (
          <p className={styles.filterHint}>
            Showing <strong style={{ color: "#ccc" }}>{filterLabel(filter)}</strong> only · {list.length} event
            {list.length === 1 ? "" : "s"}
          </p>
        )}

        {tab === "upcoming" && upcomingRows.length > 0 && list.length === 0 && filter && (
          <p className={styles.emptyText}>
            No upcoming {filterLabel(filter)} events match this filter.
          </p>
        )}

        {tab === "upcoming" && list.length > 0 && (
          <ul className={styles.cardList}>
            {list.map((event) => {
              const title = getEventResultsCardTitle(event);
              const meta = formatEventResultsListMetaLine(event);
              const logoSrc = getEventLogoPath(event.name, event.id);
              const href = eventResultsHref(event);
              return (
                <li key={event.id}>
                  <Link href={href} className={styles.cardLink}>
                    <div className={styles.cardLogoWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoSrc} alt="" className={styles.cardLogo} width={56} height={48} />
                    </div>
                    <div className={styles.cardText}>
                      <h2 className={styles.cardTitle}>{title}</h2>
                      {meta ? <p className={styles.cardMeta}>{meta}</p> : null}
                      <p className={styles.upcomingHint}>Scheduled · fantasy scoring after the show airs</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
