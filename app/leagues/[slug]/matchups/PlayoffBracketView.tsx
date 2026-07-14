import Link from "next/link";
import type { LeagueMember } from "@/lib/leagues";
import type {
  EightTeamPlayoffBracket,
  PlayoffBracketMatch,
  PlayoffBracketTeam,
} from "@/lib/leagueMatchups";
import { factionDisplayName } from "@/lib/factionName";
import { MatchupOwnerAvatarRing } from "./MatchupOwnerHeading";

type Props = {
  slug: string;
  bracket: EightTeamPlayoffBracket;
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
      <Link
        href={`/leagues/${slug}/team/${encodeURIComponent(team.userId)}`}
        className={className}
      >
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
  className,
}: {
  match: PlayoffBracketMatch;
  slug: string;
  memberByUserId: Record<string, LeagueMember>;
  className?: string;
}) {
  return (
    <div className={`bracket-match bracket-match--${match.status}${className ? ` ${className}` : ""}`}>
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
  );
}

function ChampionshipTree({
  slug,
  bracket,
  memberByUserId,
}: {
  slug: string;
  bracket: EightTeamPlayoffBracket;
  memberByUserId: Record<string, LeagueMember>;
}) {
  const qf = bracket.quarterfinals;
  const sf = bracket.championshipSemifinals;
  const final = bracket.finals[0]!;
  const championId = final.status === "complete" ? final.winnerUserId : null;
  const championTeam: PlayoffBracketTeam = championId
    ? {
        userId: championId,
        seed: bracket.seeds.find((s) => s.userId === championId)?.seed ?? null,
        points: null,
      }
    : { userId: null, seed: null, points: null };

  return (
    <div className="bracket-champ" role="img" aria-label="Championship playoff bracket">
      <div className="bracket-champ__labels">
        <span>Quarterfinals</span>
        <span aria-hidden />
        <span>Semifinals</span>
        <span aria-hidden />
        <span>Finals</span>
        <span aria-hidden />
        <span>Champion</span>
      </div>
      <div className="bracket-champ__grid">
        <BracketMatch className="bracket-champ__qf1" match={qf[0]!} slug={slug} memberByUserId={memberByUserId} />
        <BracketMatch className="bracket-champ__qf2" match={qf[1]!} slug={slug} memberByUserId={memberByUserId} />
        <BracketMatch className="bracket-champ__qf3" match={qf[2]!} slug={slug} memberByUserId={memberByUserId} />
        <BracketMatch className="bracket-champ__qf4" match={qf[3]!} slug={slug} memberByUserId={memberByUserId} />

        <div className="bracket-champ__conn bracket-champ__conn--fork bracket-champ__conn-qf-sf1" aria-hidden />
        <div className="bracket-champ__conn bracket-champ__conn--fork bracket-champ__conn-qf-sf2" aria-hidden />

        <BracketMatch className="bracket-champ__sf1" match={sf[0]!} slug={slug} memberByUserId={memberByUserId} />
        <BracketMatch className="bracket-champ__sf2" match={sf[1]!} slug={slug} memberByUserId={memberByUserId} />

        <div className="bracket-champ__conn bracket-champ__conn--fork bracket-champ__conn--fork-tall bracket-champ__conn-sf-f" aria-hidden />

        <BracketMatch className="bracket-champ__final" match={final} slug={slug} memberByUserId={memberByUserId} />

        <div className="bracket-champ__conn bracket-champ__conn--line bracket-champ__conn-f-c" aria-hidden />

        <div className="bracket-champ__champion">
          <BracketSlot
            team={championTeam}
            slug={slug}
            memberByUserId={memberByUserId}
            isWinner={Boolean(championId)}
          />
        </div>
      </div>
    </div>
  );
}

function PlacementTree({
  slug,
  bracket,
  memberByUserId,
}: {
  slug: string;
  bracket: EightTeamPlayoffBracket;
  memberByUserId: Record<string, LeagueMember>;
}) {
  const semis = bracket.consolationSemifinals;
  const place5 = bracket.finals[2]!;
  const place7 = bracket.finals[3]!;

  return (
    <div className="bracket-placement-wrap">
      <div className="bracket-place" role="img" aria-label="5th place bracket">
        <div className="bracket-place__labels">
          <span>Consolation semis</span>
          <span aria-hidden />
          <span>5th place</span>
        </div>
        <div className="bracket-place__grid">
          <BracketMatch className="bracket-place__sf1" match={semis[0]!} slug={slug} memberByUserId={memberByUserId} />
          <BracketMatch className="bracket-place__sf2" match={semis[1]!} slug={slug} memberByUserId={memberByUserId} />
          <div className="bracket-champ__conn bracket-champ__conn--fork bracket-place__conn" aria-hidden />
          <BracketMatch className="bracket-place__final" match={place5} slug={slug} memberByUserId={memberByUserId} />
        </div>
      </div>

      <div className="bracket-placement-7th">
        <div className="bracket-tree__round-label">7th place</div>
        <BracketMatch match={place7} slug={slug} memberByUserId={memberByUserId} />
      </div>
    </div>
  );
}

export function PlayoffBracketView({ slug, bracket, memberByUserId }: Props) {
  return (
    <div className="playoff-bracket">
      <section className="playoff-path" aria-label="Championship bracket">
        <h2 className="playoff-section-title">Championship</h2>
        <div className="bracket-scroll">
          <ChampionshipTree slug={slug} bracket={bracket} memberByUserId={memberByUserId} />
        </div>
      </section>

      <section className="playoff-path playoff-path--consolation" aria-label="Placement bracket">
        <h2 className="playoff-section-title">Placement</h2>
        <p className="playoff-path__note">Quarterfinal losers play for places 5–8.</p>
        <div className="bracket-scroll">
          <PlacementTree slug={slug} bracket={bracket} memberByUserId={memberByUserId} />
        </div>
      </section>
    </div>
  );
}
