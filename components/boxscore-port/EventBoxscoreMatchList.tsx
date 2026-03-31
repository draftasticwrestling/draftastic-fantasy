"use client";

import type { ComponentType } from "react";
import MatchCardUntyped from "./MatchCard";
import { getSortedMatchesForEvent } from "./utils/eventMatchesOrder";

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
    <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {sorted.map((match, matchIndex) => {
        const order = typeof match?.order === "number" ? match.order : matchIndex + 1;
        const fantasyPointsBySlug = fantasyPointsBySlugByOrder[order] ?? {};
        return (
          <MatchCard
            key={`${order}-${matchIndex}`}
            match={match}
            event={event}
            wrestlerMap={wrestlerMap}
            matchIndex={matchIndex}
            events={events}
            isClickable={false}
            fantasyPointsBySlug={fantasyPointsBySlug}
          />
        );
      })}
    </section>
  );
}
