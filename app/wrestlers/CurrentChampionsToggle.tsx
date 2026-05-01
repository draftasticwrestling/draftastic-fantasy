"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type ChampionItem = {
  champion: string;
  championSlug: string;
  imageUrl: string | null;
};

type ChampionCard = {
  slug: string;
  title: string;
  champs: ChampionItem[];
  tagTeamName: string | null;
  hasTeamNameRow: boolean;
  beltImageUrl: string | null;
  /** From full title history vs championships-table snapshot only. */
  hasHistory?: boolean;
};

type Props = {
  cards: ChampionCard[];
};

function isNxtCard(card: { title: string; slug: string }): boolean {
  if (/^nxt-/i.test(card.slug)) return true;
  const t = card.title.trim().toLowerCase();
  return t.startsWith("nxt ") || /\bnxt\b/i.test(card.title);
}

function isTagTeamCard(title: string): boolean {
  return /\btag\s+team\b/i.test(title);
}

function beltClassName(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const base = src.toLowerCase().split("?")[0];
  const parts: string[] = [];
  if (
    base.endsWith("mens-intercontinental-championship.png") ||
    base.endsWith("mens-united-states-championship.png")
  ) {
    parts.push("wrestlers-champ-card__belt--mens-boost");
  }
  if (
    base.endsWith("womens-intercontinental-championship.png") ||
    base.endsWith("womens-united-states-championship.png")
  ) {
    parts.push("wrestlers-champ-card__belt--womens-ic-us-cap");
  }
  return parts.length ? parts.join(" ") : undefined;
}

export function CurrentChampionsToggle({ cards }: Props) {
  const [tab, setTab] = useState<"main" | "nxt">("main");
  const filtered = useMemo(
    () => cards.filter((c) => (tab === "nxt" ? isNxtCard(c) : !isNxtCard(c))),
    [cards, tab]
  );

  return (
    <>
      <div style={{ display: "inline-flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className="wrestlers-champ-title-history-pill"
          onClick={() => setTab("main")}
          style={{ opacity: tab === "main" ? 1 : 0.65 }}
        >
          Main Roster
        </button>
        <button
          type="button"
          className="wrestlers-champ-title-history-pill"
          onClick={() => setTab("nxt")}
          style={{ opacity: tab === "nxt" ? 1 : 0.65 }}
        >
          NXT
        </button>
      </div>
      {filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", margin: "0 0 14px" }}>
          No championships found for this category yet.
        </p>
      ) : null}
      <div className="wrestlers-page-champs-grid">
        {filtered.map((card) => (
          <article key={card.slug} className="wrestlers-champ-card">
            <h3 className="wrestlers-champ-card__title">
              <span className="wrestlers-champ-card__title-text">{card.title}</span>
            </h3>
            <div className="wrestlers-champ-card__belt" aria-hidden={!card.beltImageUrl}>
              {card.beltImageUrl ? (
                <Image
                  src={card.beltImageUrl}
                  alt=""
                  width={200}
                  height={58}
                  sizes="200px"
                  loading="lazy"
                  className={beltClassName(card.beltImageUrl)}
                />
              ) : null}
            </div>
            <div className="wrestlers-champ-card__avatars">
              {card.champs.map((c) => (
                <div key={`${card.title}-${c.championSlug || c.champion}`}>
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt={c.champion}
                      width={52}
                      height={52}
                      sizes="52px"
                      loading="lazy"
                      className="wrestlers-champ-card__avatar-img"
                    />
                  ) : (
                    <div className="wrestlers-champ-card__avatar-ph" aria-hidden>
                      ?
                    </div>
                  )}
                </div>
              ))}
            </div>
            {card.hasTeamNameRow ? (
              <div
                className={`wrestlers-champ-card__team-name${
                  card.tagTeamName ? "" : " wrestlers-champ-card__team-name--empty"
                }`}
              >
                {card.tagTeamName ?? "\u00a0"}
              </div>
            ) : null}
            <div
              className={`wrestlers-champ-card__names${isTagTeamCard(card.title) ? " wrestlers-champ-card__names--single-line" : ""}`}
            >
              {card.champs.map((c) => c.champion).join(" & ")}
            </div>
            <div className="wrestlers-champ-card__footer">
              {card.hasHistory !== false ? (
                <Link
                  href={`/championship/${encodeURIComponent(card.slug)}`}
                  className="wrestlers-champ-title-history-pill"
                >
                  Title History
                </Link>
              ) : (
                <span
                  className="wrestlers-champ-title-history-pill"
                  style={{ opacity: 0.7, cursor: "default" }}
                  aria-label="Current champion snapshot"
                >
                  Current Snapshot
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
