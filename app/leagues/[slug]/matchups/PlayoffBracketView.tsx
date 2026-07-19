import Link from "next/link";
import type { ReactNode } from "react";
import type { LeagueMember } from "@/lib/leagues";
import type {
  PlayoffBracket,
  PlayoffBracketMatch,
  PlayoffBracketTeam,
} from "@/lib/leagueMatchups";
import { factionDisplayName } from "@/lib/factionName";
import { MatchupOwnerAvatarRing } from "./MatchupOwnerHeading";

type Props = {
  slug: string;
  bracket: PlayoffBracket;
  memberByUserId: Record<string, LeagueMember>;
};

function teamLabel(member: LeagueMember | undefined): string {
  return factionDisplayName(member, "TBD");
}

function BracketSlot({
  team,
  slug,
  memberByUserId,
  isWinner,
  isLoser,
}: {
  team: PlayoffBracketTeam;
  slug: string;
  memberByUserId: Record<string, LeagueMember>;
  isWinner?: boolean;
  isLoser?: boolean;
}) {
  const member = team.userId ? memberByUserId[team.userId] : undefined;
  const className = [
    "bracket-slot",
    isWinner ? "is-winner" : "",
    isLoser ? "is-loser" : "",
    !team.userId ? "is-tbd" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className="bracket-slot__seed">{team.seed != null ? team.seed : ""}</span>
      <span className="bracket-slot__body">
        {team.userId ? (
          <>
            <MatchupOwnerAvatarRing member={member ?? null} size={22} />
            <span className="bracket-slot__name">{teamLabel(member)}</span>
          </>
        ) : (
          <span className="bracket-slot__name bracket-slot__name--tbd">TBD</span>
        )}
      </span>
      <span className="bracket-slot__pts">
        {team.userId != null && team.points != null ? team.points : ""}
      </span>
    </>
  );

  if (team.userId) {
    return (
      <Link href={`/leagues/${slug}/team/${encodeURIComponent(team.userId)}`} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function BracketMatch({
  match,
  slug,
  memberByUserId,
  caption,
}: {
  match: PlayoffBracketMatch;
  slug: string;
  memberByUserId: Record<string, LeagueMember>;
  caption?: string;
}) {
  return (
    <div className="bracket-cell">
      {caption ? <div className="bracket-cell__caption">{caption}</div> : null}
      <div className={`bracket-match bracket-match--${match.status}`}>
        {match.teams.map((t, i) => (
          <BracketSlot
            key={`${match.id}-${i}`}
            team={t}
            slug={slug}
            memberByUserId={memberByUserId}
            isWinner={Boolean(t.userId && match.winnerUserId === t.userId)}
            isLoser={Boolean(match.winnerUserId && t.userId && match.winnerUserId !== t.userId)}
          />
        ))}
      </div>
    </div>
  );
}

function ChampionColumn({
  slug,
  bracket,
  memberByUserId,
}: {
  slug: string;
  bracket: PlayoffBracket;
  memberByUserId: Record<string, LeagueMember>;
}) {
  const champion = bracket.champion ?? { userId: null, seed: null, points: null };
  return (
    <div className="bracket-col bracket-col--champion">
      <div className="bracket-col__label">Champion</div>
      <div className="bracket-col__cells">
        <div className="bracket-cell">
          <BracketSlot
            team={champion}
            slug={slug}
            memberByUserId={memberByUserId}
            isWinner={Boolean(champion.userId)}
          />
        </div>
      </div>
    </div>
  );
}

function BracketColumns({
  slug,
  memberByUserId,
  rounds,
  roundLabels,
  showMatchCaptions,
  trailing,
}: {
  slug: string;
  memberByUserId: Record<string, LeagueMember>;
  rounds: PlayoffBracketMatch[][];
  roundLabels: string[];
  showMatchCaptions?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="bracket-scroll">
      <div className="bracket-cols">
        {rounds.map((matches, r) =>
          matches.length === 0 ? null : (
            <div className="bracket-col" key={`round-${r}`}>
              <div className="bracket-col__label">{roundLabels[r] ?? ""}</div>
              <div className="bracket-col__cells">
                {matches.map((m) => (
                  <BracketMatch
                    key={m.id}
                    match={m}
                    slug={slug}
                    memberByUserId={memberByUserId}
                    caption={showMatchCaptions ? m.label : undefined}
                  />
                ))}
              </div>
            </div>
          )
        )}
        {trailing}
      </div>
    </div>
  );
}

export function PlayoffBracketView({ slug, bracket, memberByUserId }: Props) {
  const hasPlacement =
    bracket.placementRounds.some((r) => r.length > 0) || bracket.autoPlacements.length > 0;

  return (
    <div className="playoff-bracket">
      <section className="playoff-path" aria-label="Championship bracket">
        <h2 className="playoff-section-title">Championship</h2>
        <BracketColumns
          slug={slug}
          memberByUserId={memberByUserId}
          rounds={bracket.championshipRounds}
          roundLabels={bracket.roundLabels}
          trailing={
            <ChampionColumn slug={slug} bracket={bracket} memberByUserId={memberByUserId} />
          }
        />
      </section>

      {hasPlacement ? (
        <section className="playoff-path playoff-path--consolation" aria-label="Placement bracket">
          <h2 className="playoff-section-title">Placement</h2>
          <p className="playoff-path__note">Losers play on to decide the remaining places.</p>
          <BracketColumns
            slug={slug}
            memberByUserId={memberByUserId}
            rounds={bracket.placementRounds}
            roundLabels={bracket.roundLabels}
            showMatchCaptions
            trailing={
              bracket.autoPlacements.length > 0 ? (
                <div className="bracket-col">
                  <div className="bracket-col__label">Final places</div>
                  <div className="bracket-col__cells">
                    {bracket.autoPlacements.map((ap) => (
                      <div className="bracket-cell" key={`auto-${ap.rank}`}>
                        <div className="bracket-cell__caption">{ap.label}</div>
                        <BracketSlot team={ap.team} slug={slug} memberByUserId={memberByUserId} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : undefined
            }
          />
        </section>
      ) : null}
    </div>
  );
}
