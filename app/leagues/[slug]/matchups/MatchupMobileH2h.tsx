import Image from "next/image";
import Link from "next/link";
import type { LeagueMember } from "@/lib/leagues";
import { MatchupOwnerAvatarRing } from "./MatchupOwnerHeading";

export type MatchupMobileTeamMasthead = {
  userId: string;
  label: string;
  member: LeagueMember | null;
  total: number;
  eventPts: number;
  winBonus: number;
  beltBonus: number;
  isWinner: boolean;
  isBeltHolder: boolean;
};

export type MatchupMobileRosterRow = {
  slot: number;
  wrestlerId: string;
  name: string;
  points: number;
  eventPts: number;
  monthlyPts: number;
  txnLines: string[];
};

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function MatchupMobileWrestlerThumb({
  imageUrl,
  name,
}: {
  imageUrl: string | null | undefined;
  name: string;
}) {
  const trimmed = imageUrl?.trim();
  if (trimmed) {
    return (
      <Image
        src={trimmed}
        alt=""
        width={40}
        height={40}
        className="matchup-mobile-wrestler-thumb__img"
        sizes="40px"
      />
    );
  }
  return (
    <div className="matchup-mobile-wrestler-thumb__ph" aria-hidden>
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </div>
  );
}

/** ESPN-style mobile masthead: teams on the sides, big scores + share bar in the center. */
export function MatchupMobileH2hMasthead({
  teamA,
  teamB,
  ownerBonusRules,
}: {
  teamA: MatchupMobileTeamMasthead;
  teamB: MatchupMobileTeamMasthead;
  ownerBonusRules: boolean;
}) {
  const sum = teamA.total + teamB.total;
  const leftShare = sum > 0 ? Math.round((teamA.total / sum) * 1000) / 10 : 50;
  const rightShare = sum > 0 ? Math.round((teamB.total / sum) * 1000) / 10 : 50;
  const leading = teamA.total > teamB.total ? "a" : teamB.total > teamA.total ? "b" : null;

  const bonusLine = (t: MatchupMobileTeamMasthead) => {
    const parts: string[] = [];
    parts.push(`${formatPts(t.eventPts)} event`);
    if (ownerBonusRules && t.winBonus > 0) parts.push(`+${t.winBonus} win`);
    if (ownerBonusRules && t.beltBonus > 0) parts.push(`+${t.beltBonus} belt`);
    return parts.join(" · ");
  };

  const teamCol = (t: MatchupMobileTeamMasthead, side: "left" | "right") => (
    <div className={`matchup-mobile-masthead__team matchup-mobile-masthead__team--${side}`}>
      <MatchupOwnerAvatarRing member={t.member} size={44} />
      <div className="matchup-mobile-masthead__team-text">
        <div className="matchup-mobile-masthead__name">{t.label}</div>
        <div className="matchup-mobile-masthead__badges">
          {t.isWinner ? <span className="matchup-mobile-masthead__pill matchup-mobile-masthead__pill--win">Winner</span> : null}
          {t.isBeltHolder && !t.isWinner ? (
            <span className="matchup-mobile-masthead__pill matchup-mobile-masthead__pill--belt">Belt</span>
          ) : null}
        </div>
        <div className="matchup-mobile-masthead__sub">{bonusLine(t)}</div>
      </div>
    </div>
  );

  return (
    <div className="matchup-mobile-h2h-header">
      <div className="matchup-mobile-masthead">
        {teamCol(teamA, "left")}
        <div className="matchup-mobile-masthead__center">
          <div className="matchup-mobile-masthead__scores">
            <span
              className={
                leading === "a"
                  ? "matchup-mobile-masthead__score matchup-mobile-masthead__score--lead"
                  : "matchup-mobile-masthead__score"
              }
            >
              {formatPts(teamA.total)}
            </span>
            <span className="matchup-mobile-masthead__score-sep">—</span>
            <span
              className={
                leading === "b"
                  ? "matchup-mobile-masthead__score matchup-mobile-masthead__score--lead"
                  : "matchup-mobile-masthead__score"
              }
            >
              {formatPts(teamB.total)}
            </span>
          </div>
          <div className="matchup-mobile-masthead__vs">VS</div>
          <div className="matchup-mobile-masthead__share-label">Score share</div>
          <div className="matchup-mobile-masthead__share-bar" aria-hidden>
            <div
              className="matchup-mobile-masthead__share-seg matchup-mobile-masthead__share-seg--left"
              style={{ flex: Math.max(0, teamA.total) || 1 }}
            />
            <div
              className="matchup-mobile-masthead__share-seg matchup-mobile-masthead__share-seg--right"
              style={{ flex: Math.max(0, teamB.total) || 1 }}
            />
          </div>
          <div className="matchup-mobile-masthead__share-pct">
            <span>{leftShare}%</span>
            <span>{rightShare}%</span>
          </div>
        </div>
        {teamCol(teamB, "right")}
      </div>
    </div>
  );
}

function slotPointsLine(row: MatchupMobileRosterRow | undefined): string | null {
  if (!row?.wrestlerId) return null;
  if (row.points <= 0) return row.monthlyPts > 0 ? `0 + ${row.monthlyPts} belt` : "0";
  if (row.monthlyPts > 0) return `+${formatPts(row.eventPts)} + ${row.monthlyPts} belt`;
  return `+${formatPts(row.points)}`;
}

/** Per-slot row: left wrestler | slot pill | right wrestler (mirrored like fantasy matchup apps). */
export function MatchupMobileH2hLineup({
  maxSlots,
  rowsLeft,
  rowsRight,
  leagueSlug,
  wrestlerMeta,
}: {
  maxSlots: number;
  rowsLeft: MatchupMobileRosterRow[];
  rowsRight: MatchupMobileRosterRow[];
  leagueSlug: string;
  wrestlerMeta: Record<string, { image_url?: string | null; brand?: string | null }>;
}) {
  return (
    <div className="matchup-mobile-lineup">
      {Array.from({ length: maxSlots }, (_, i) => {
        const left = rowsLeft[i];
        const right = rowsRight[i];
        const slot = i + 1;
        return (
          <div key={slot} className="matchup-mobile-slot-row">
            <div className="matchup-mobile-slot-side matchup-mobile-slot-side--left">
              <MatchupMobileWrestlerThumb
                imageUrl={left?.wrestlerId ? wrestlerMeta[left.wrestlerId]?.image_url : undefined}
                name={left?.name ?? "—"}
              />
              <div className="matchup-mobile-slot-body">
                {left?.wrestlerId ? (
                  <Link
                    href={`/wrestlers/${encodeURIComponent(left.wrestlerId)}?league=${encodeURIComponent(leagueSlug)}`}
                    className="app-link matchup-mobile-slot-name"
                  >
                    {left.name}
                  </Link>
                ) : (
                  <span className="matchup-mobile-slot-name matchup-mobile-slot-name--empty">—</span>
                )}
                {left?.wrestlerId && wrestlerMeta[left.wrestlerId]?.brand ? (
                  <div className="matchup-mobile-slot-brand">{wrestlerMeta[left.wrestlerId]!.brand}</div>
                ) : null}
                <div className="matchup-mobile-slot-pts">
                  {slotPointsLine(left) ?? "—"}
                </div>
                {left?.txnLines?.length ? (
                  <div className="matchup-mobile-slot-txn">
                    {left.txnLines.map((line, li) => (
                      <span key={li}>{line}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="matchup-mobile-slot-hub">
              <span className="matchup-mobile-slot-pill">{slot}</span>
              <span className="matchup-mobile-slot-chev" aria-hidden>
                ▼
              </span>
            </div>
            <div className="matchup-mobile-slot-side matchup-mobile-slot-side--right">
              <div className="matchup-mobile-slot-body matchup-mobile-slot-body--right">
                {right?.wrestlerId ? (
                  <Link
                    href={`/wrestlers/${encodeURIComponent(right.wrestlerId)}?league=${encodeURIComponent(leagueSlug)}`}
                    className="app-link matchup-mobile-slot-name"
                  >
                    {right.name}
                  </Link>
                ) : (
                  <span className="matchup-mobile-slot-name matchup-mobile-slot-name--empty">—</span>
                )}
                {right?.wrestlerId && wrestlerMeta[right.wrestlerId]?.brand ? (
                  <div className="matchup-mobile-slot-brand">{wrestlerMeta[right.wrestlerId]!.brand}</div>
                ) : null}
                <div className="matchup-mobile-slot-pts">
                  {slotPointsLine(right) ?? "—"}
                </div>
                {right?.txnLines?.length ? (
                  <div className="matchup-mobile-slot-txn">
                    {right.txnLines.map((line, li) => (
                      <span key={li}>{line}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <MatchupMobileWrestlerThumb
                imageUrl={right?.wrestlerId ? wrestlerMeta[right.wrestlerId]?.image_url : undefined}
                name={right?.name ?? "—"}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
