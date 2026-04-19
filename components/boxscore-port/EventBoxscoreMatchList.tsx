"use client";

import type { ComponentType } from "react";
import MatchCardUntyped from "./MatchCard";
import { getSortedMatchesForEvent } from "./utils/eventMatchesOrder";
import { shouldUseMatchDetailPage } from "./utils/matchDetailPageEligibility";

export type FantasyPointsBySlug = Record<
  string,
  { points: number; isWinner: boolean; breakdown: string[] }
>;

type EventLike = {
  matches?: unknown[] | null;
  id?: string;
  name?: string | null;
  date?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

type MatchCardProps = {
  match: unknown;
  event: EventLike;
  wrestlerMap: Record<string, Record<string, unknown>>;
  isClickable?: boolean;
  matchIndex?: number;
  events: EventLike[];
  fantasyPointsBySlug?: FantasyPointsBySlug | null;
};


const MatchCard = MatchCardUntyped as ComponentType<MatchCardProps>;

type Props = {
  event: EventLike;
  wrestlerMap: Record<string, Record<string, unknown>>;
  events: EventLike[];
  fantasyPointsBySlugByOrder: Record<number, FantasyPointsBySlug>;
};

export default function EventBoxscoreMatchList({
  event,
  wrestlerMap,
  events,
  fantasyPointsBySlugByOrder,
}: Props) {
  const sorted = getSortedMatchesForEvent(event);
  return (
    <section className="event-results-match-list">
      {sorted.map((match, matchIndex) => {
        const order = typeof match?.order === "number" ? match.order : matchIndex + 1;
        const fantasyPointsBySlug = fantasyPointsBySlugByOrder[order] ?? {};
        return (
          <div
            key={`${order}-${matchIndex}`}
            id={`match-${matchIndex + 1}`}
            className="event-results-match-anchor"
          >
            <MatchCard
              match={match}
              event={event}
              wrestlerMap={wrestlerMap}
              matchIndex={matchIndex}
              events={events}
              isClickable={shouldUseMatchDetailPage(match)}
              fantasyPointsBySlug={fantasyPointsBySlug}
            />
          </div>
        );
      })}
    </section>
  );
}
