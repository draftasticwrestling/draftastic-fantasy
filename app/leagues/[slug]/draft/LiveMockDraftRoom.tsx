"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import WrestlerHeadshotImage from "@/app/components/WrestlerHeadshotImage";
import { factionDisplayName } from "@/lib/factionName";
import { formatPickClock, formatPoints, genderNeeded } from "@/lib/mockDraftEngine";
import { createClient } from "@/lib/supabase/client";
import { getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import styles from "@/app/mock-draft/mock-draft.module.css";
import { expireLiveDraftClockAction, makeDraftPickWithStateAction, syncLiveDraftRoomAction } from "./actions";

type Tab = "players" | "queue" | "team" | "room";
type Brand = "Raw" | "SmackDown" | "NXT" | "Other";
type Gender = "M" | "F" | "U";

type Wrestler = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  status?: string | null;
  image_url?: string | null;
  rating_2k26?: number | null;
  rating_2k25?: number | null;
};

type PickRow = {
  overall_pick: number;
  user_id: string;
  wrestler_id: string;
  wrestler_name: string | null;
};

type PointsBySlug = Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

type Props = {
  leagueId: string;
  leagueSlug: string;
  order: { overall_pick: number; user_id: string }[];
  picksHistory: PickRow[];
  members: { user_id: string; display_name?: string | null; team_name?: string | null }[];
  wrestlers: Wrestler[];
  pointsAllTimeBySlug: PointsBySlug;
  pointsNinetyDayBySlug: PointsBySlug;
  pointsLastSeasonBySlug: PointsBySlug;
  points2026BySlug: PointsBySlug;
  points2025BySlug: PointsBySlug;
  pointsSinceStartBySlug: PointsBySlug;
  includeNxt?: boolean;
  draftedIds: string[];
  currentPickSlot: number | null;
  totalPicks: number;
  draftStatus: string;
  currentPickerUserId: string | null;
  draftCurrentPickStartedAt: string | null;
  timePerPickSeconds: number;
  viewerUserId: string | null;
  viewerIsCommissioner: boolean;
  priorityList: string[];
  draftStyle: "snake" | "linear";
  rosterSize: number;
  minFemale: number;
  minMale: number;
};

const BRAND_SHORT: Record<Brand, string> = {
  Raw: "RAW",
  SmackDown: "SD",
  NXT: "NXT",
  Other: "OTHER",
};

function brandOf(brand: string | null | undefined): Brand {
  const lower = (brand ?? "").trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  return "Other";
}

function brandClass(brand: Brand): string {
  if (brand === "Raw") return styles.raw;
  if (brand === "SmackDown") return styles.sd;
  if (brand === "NXT") return styles.nxt;
  return styles.other;
}

function genderOf(gender: string | null | undefined): Gender {
  const lower = (gender ?? "").trim().toLowerCase();
  if (lower === "female" || lower === "f") return "F";
  if (lower === "male" || lower === "m") return "M";
  return "U";
}

function injuredOf(status: string | null | undefined): boolean {
  const value = (status ?? "").trim().toLowerCase();
  return value === "injured" || value === "inj" || value.includes("injured");
}

function InjuryMark() {
  return (
    <span className={styles.injury} role="img" aria-label="Injured" title="Injured">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M4 0h2v4h4v2H6v4H4V6H0V4h4z" fill="currentColor" />
      </svg>
    </span>
  );
}

type PointsPeriod = "allTime" | "ninetyDay" | "lastSeason" | "y2026" | "y2025" | "sinceStart";

const POINTS_PERIODS: { id: PointsPeriod; label: string }[] = [
  { id: "allTime", label: "All-time points" },
  { id: "ninetyDay", label: "Last 90 days" },
  { id: "lastSeason", label: "Last season" },
  { id: "y2026", label: "2026 points" },
  { id: "y2025", label: "2025 points" },
  { id: "sinceStart", label: "Since league start" },
];

function pointsOf(points: PointsBySlug, id: string): number {
  const row = getPointsForWrestler(points, id, id) as
    | { rsPoints?: number; plePoints?: number; beltPoints?: number }
    | undefined;
  return (row?.rsPoints ?? 0) + (row?.plePoints ?? 0) + (row?.beltPoints ?? 0);
}

export function LiveMockDraftRoom({
  leagueId,
  leagueSlug,
  order,
  picksHistory,
  members,
  wrestlers,
  pointsAllTimeBySlug,
  pointsNinetyDayBySlug,
  pointsLastSeasonBySlug,
  points2026BySlug,
  points2025BySlug,
  pointsSinceStartBySlug,
  includeNxt = true,
  draftedIds,
  currentPickSlot,
  totalPicks,
  draftStatus,
  currentPickerUserId,
  draftCurrentPickStartedAt,
  timePerPickSeconds,
  viewerUserId,
  viewerIsCommissioner,
  priorityList,
  draftStyle,
  rosterSize,
  minFemale,
  minMale,
}: Props) {
  const [tab, setTab] = useState<Tab>(draftStatus === "completed" ? "team" : "players");
  const [roomRows, setRoomRows] = useState<{ user_id: string; is_ready: boolean; last_seen_at: string }[]>([]);
  const [roomNow, setRoomNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [brands, setBrands] = useState<Set<Brand>>(() =>
    new Set(includeNxt ? ["Raw", "SmackDown", "NXT"] : ["Raw", "SmackDown"])
  );
  const [pointsPeriod, setPointsPeriod] = useState<PointsPeriod>("allTime");
  const queue = priorityList;
  const [autopick, setAutopick] = useState(false);
  const [showAutopickNote, setShowAutopickNote] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(timePerPickSeconds);
  const [picks, setPicks] = useState(picksHistory);
  const [takenIds, setTakenIds] = useState(draftedIds);
  const [slot, setSlot] = useState(currentPickSlot);
  const [pickerId, setPickerId] = useState(currentPickerUserId);
  const [startedAt, setStartedAt] = useState(draftCurrentPickStartedAt);
  const [status, setStatus] = useState(draftStatus);
  const expireLock = useRef(false);
  const autoAttemptedSlot = useRef<number | null>(null);

  const serverPickKey = picksHistory.map((pick) => `${pick.overall_pick}:${pick.wrestler_id}`).join("|");
  useEffect(() => {
    setPicks(picksHistory);
    setTakenIds(draftedIds);
    setSlot(currentPickSlot);
    setPickerId(currentPickerUserId);
    setStartedAt(draftCurrentPickStartedAt);
    setStatus(draftStatus);
  }, [serverPickKey, currentPickSlot, currentPickerUserId, draftCurrentPickStartedAt, draftStatus, picksHistory, draftedIds]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(`live-draft-autopick:${leagueId}`);
    if (stored === "1") setAutopick(true);
  }, [leagueId]);

  useEffect(() => {
    if (!autopick) {
      setShowAutopickNote(false);
      return;
    }
    setShowAutopickNote(true);
    const hide = window.setTimeout(() => setShowAutopickNote(false), 2800);
    return () => window.clearTimeout(hide);
  }, [autopick]);

  useEffect(() => {
    if (!viewerUserId) return;
    const userId = viewerUserId;
    const supabase = createClient();
    let cancelled = false;
    const tick = window.setInterval(() => setRoomNow(Date.now()), 5000);

    async function beat() {
      const { data } = await supabase
        .from("league_draft_lobby")
        .select("is_ready")
        .eq("league_id", leagueId)
        .eq("user_id", userId)
        .maybeSingle();
      const isReady = Boolean((data as { is_ready?: boolean } | null)?.is_ready);
      await supabase.from("league_draft_lobby").upsert(
        {
          league_id: leagueId,
          user_id: userId,
          is_ready: isReady,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "league_id,user_id" }
      );
    }
    async function loadRows() {
      const { data } = await supabase
        .from("league_draft_lobby")
        .select("user_id, is_ready, last_seen_at")
        .eq("league_id", leagueId);
      if (!cancelled) setRoomRows((data ?? []) as { user_id: string; is_ready: boolean; last_seen_at: string }[]);
    }
    void beat();
    void loadRows();
    const heartbeat = window.setInterval(() => {
      void beat();
    }, 20000);
    const channel = supabase
      .channel(`league-draft-room-presence-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_draft_lobby", filter: `league_id=eq.${leagueId}` },
        () => {
          void loadRows();
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, viewerUserId]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);
  const byId = useMemo(() => new Map(wrestlers.map((wrestler) => [wrestler.id, wrestler])), [wrestlers]);
  const teamCount = useMemo(() => new Set(order.map((seat) => seat.user_id)).size, [order]);
  const teamIds = useMemo(() => order.slice(0, teamCount).map((seat) => seat.user_id), [order, teamCount]);
  const rounds = teamCount > 0 ? Math.ceil(order.length / teamCount) : 0;
  const snake = draftStyle !== "linear";
  const taken = useMemo(() => new Set(takenIds), [takenIds]);
  const pickByOverall = useMemo(() => new Map(picks.map((pick) => [pick.overall_pick, pick])), [picks]);

  function columnForOverall(overall: number): number {
    const index = overall - 1;
    const round = Math.floor(index / teamCount);
    const indexInRound = index % teamCount;
    return snake && (round + 1) % 2 === 0 ? teamCount - 1 - indexInRound : indexInRound;
  }

  function overallFor(round: number, teamIndex: number): number {
    const indexInRound = snake && round % 2 === 0 ? teamCount - 1 - teamIndex : teamIndex;
    return (round - 1) * teamCount + indexInRound + 1;
  }

  const myTurn = status === "in_progress" && pickerId != null && pickerId === viewerUserId;
  const canDraft =
    status === "in_progress" && pickerId != null && (pickerId === viewerUserId || viewerIsCommissioner);
  const onClockName =
    pickerId == null
      ? "Waiting"
      : pickerId === viewerUserId
        ? "You"
        : factionDisplayName(memberById.get(pickerId), "Manager");

  const pointsMap =
    pointsPeriod === "ninetyDay"
      ? pointsNinetyDayBySlug
      : pointsPeriod === "lastSeason"
        ? pointsLastSeasonBySlug
        : pointsPeriod === "y2026"
          ? points2026BySlug
          : pointsPeriod === "y2025"
            ? points2025BySlug
            : pointsPeriod === "sinceStart"
              ? pointsSinceStartBySlug
              : pointsAllTimeBySlug;
  const ranked = useMemo(() => {
    return wrestlers
      .filter((wrestler) => {
        const brand = brandOf(wrestler.brand);
        if (brand !== "Raw" && brand !== "SmackDown" && brand !== "NXT") return false;
        if (brand === "NXT" && !includeNxt) return false;
        return true;
      })
      .map((wrestler) => {
        const rating = Number(wrestler.rating_2k26 ?? wrestler.rating_2k25 ?? 0) || 0;
        const points = pointsOf(pointsMap, wrestler.id);
        return { wrestler, points, rating };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.rating - a.rating ||
          (a.wrestler.name ?? a.wrestler.id).localeCompare(b.wrestler.name ?? b.wrestler.id)
      )
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [includeNxt, pointsMap, wrestlers]);
  const rankById = useMemo(() => new Map(ranked.map((row) => [row.wrestler.id, row.rank])), [ranked]);
  const pointsById = useMemo(() => new Map(ranked.map((row) => [row.wrestler.id, row.points])), [ranked]);

  const clockRoster = useMemo(() => {
    if (!pickerId) return [];
    return picks
      .filter((pick) => pick.user_id === pickerId)
      .map((pick) => ({ gender: genderOf(byId.get(pick.wrestler_id)?.gender) }));
  }, [byId, pickerId, picks]);
  const need = genderNeeded({ rosterSize, minFemale, minMale }, clockRoster);
  const myRoster = useMemo(() => {
    if (!viewerUserId) return [];
    return picks.filter((pick) => pick.user_id === viewerUserId);
  }, [picks, viewerUserId]);
  const myWomen = myRoster.filter((pick) => genderOf(byId.get(pick.wrestler_id)?.gender) === "F").length;
  const myMen = myRoster.filter((pick) => genderOf(byId.get(pick.wrestler_id)?.gender) === "M").length;

  const lastPick = useMemo(() => {
    const latest = [...picks].sort((a, b) => b.overall_pick - a.overall_pick)[0];
    if (!latest) return snake ? "Snake draft · all-time points" : "Linear draft · all-time points";
    const who =
      latest.user_id === viewerUserId
        ? "You"
        : factionDisplayName(memberById.get(latest.user_id), "A manager");
    const name = latest.wrestler_name ?? byId.get(latest.wrestler_id)?.name ?? latest.wrestler_id;
    return `${who} drafted ${name}`;
  }, [byId, memberById, picks, snake, viewerUserId]);

  function applyPick(pick: PickRow, nextStartedAt: string | null) {
    setPicks((current) => {
      if (current.some((row) => row.overall_pick === pick.overall_pick)) return current;
      return [...current, pick].sort((a, b) => a.overall_pick - b.overall_pick);
    });
    setTakenIds((current) => (current.includes(pick.wrestler_id) ? current : [...current, pick.wrestler_id]));
    const nextSlot = pick.overall_pick + 1;
    const next = order.find((seat) => seat.overall_pick === nextSlot);
    if (!next || nextSlot > totalPicks) {
      setStatus("completed");
      setSlot(null);
      setPickerId(null);
      return;
    }
    setSlot(nextSlot);
    setPickerId(next.user_id);
    setStartedAt(nextStartedAt);
    expireLock.current = false;
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`league-draft-picks-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "league_draft_picks", filter: `league_id=eq.${leagueId}` },
        (payload) => {
          const row = payload.new as {
            overall_pick?: number;
            user_id?: string;
            wrestler_id?: string;
            picked_at?: string;
          };
          if (row.overall_pick == null || !row.user_id || !row.wrestler_id) return;
          const name = byId.get(row.wrestler_id)?.name ?? null;
          applyPick(
            {
              overall_pick: row.overall_pick,
              user_id: row.user_id,
              wrestler_id: row.wrestler_id,
              wrestler_name: name,
            },
            row.picked_at ?? new Date().toISOString()
          );
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // applyPick closes over the latest order via the render that owns this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byId, leagueId, order, totalPicks]);

  const picksRef = useRef(picks);
  picksRef.current = picks;
  useEffect(() => {
    if (status !== "in_progress") return;
    let cancelled = false;
    async function pull() {
      const snapshot = await syncLiveDraftRoomAction(leagueSlug);
      if (cancelled || snapshot.error) return;
      const localMax = picksRef.current.reduce((max, pick) => Math.max(max, pick.overall_pick), 0);
      const serverMax = snapshot.picks.reduce((max, pick) => Math.max(max, pick.overall_pick), 0);
      if (serverMax < localMax) return;
      if (serverMax > localMax || snapshot.picks.length !== picksRef.current.length) {
        setPicks(snapshot.picks);
        setTakenIds((current) => {
          const next = new Set(current);
          for (const pick of snapshot.picks) next.add(pick.wrestler_id);
          return [...next];
        });
        expireLock.current = false;
      }
      setSlot(snapshot.slot);
      setPickerId(snapshot.pickerId);
      setStartedAt(snapshot.startedAt);
      setStatus(snapshot.status);
    }
    void pull();
    const timer = window.setInterval(() => {
      void pull();
    }, 2000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [leagueSlug, status]);

  useEffect(() => {
    if (status !== "in_progress" || !startedAt || slot == null) return;
    const startMs = new Date(startedAt).getTime();
    if (!Number.isFinite(startMs)) return;
    let stopped = false;

    const expire = (attempt: number) => {
      if (stopped || expireLock.current) return;
      expireLock.current = true;
      const mine = viewerUserId != null && viewerUserId === pickerId;
      if (attempt === 0 && !mine) {
        expireLock.current = false;
        window.setTimeout(() => expire(1), 1200);
        return;
      }
      void expireLiveDraftClockAction(leagueSlug).then((result) => {
        if (stopped) return;
        const remaining = result.secondsRemaining ?? 0;
        if (!result.didAutoPick && remaining > 0) {
          setStartedAt(new Date(Date.now() - Math.max(0, timePerPickSeconds - remaining) * 1000).toISOString());
          expireLock.current = false;
          return;
        }
        if (result.didAutoPick && result.pick) {
          const name = byId.get(result.pick.wrestler_id)?.name ?? null;
          applyPick(
            { ...result.pick, wrestler_name: name },
            result.nextStartedAt ?? result.pick.picked_at
          );
          return;
        }
        if (result.retry && attempt < 3) {
          expireLock.current = false;
          window.setTimeout(() => expire(attempt + 1), 2000);
          return;
        }
        if (result.error) setPickError(result.error);
        expireLock.current = false;
      });
    };

    const tick = () => {
      const left = timePerPickSeconds - Math.floor((Date.now() - startMs) / 1000);
      if (left <= 0) {
        setSecondsLeft(0);
        expire(0);
      } else {
        setSecondsLeft(left);
      }
    };
    tick();
    const interval = window.setInterval(tick, 200);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [byId, leagueSlug, pickerId, slot, startedAt, status, timePerPickSeconds, viewerUserId]);

  useEffect(() => {
    document.getElementById("live-pick-current")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [slot]);

  async function draftWrestler(wrestlerId: string) {
    if (!canDraft || pendingId || taken.has(wrestlerId)) return;
    if (need && genderOf(byId.get(wrestlerId)?.gender) !== need) return;
    setPendingId(wrestlerId);
    setPickError(null);
    const formData = new FormData();
    formData.set("league_slug", leagueSlug);
    formData.set("wrestler_id", wrestlerId);
    const result = await makeDraftPickWithStateAction({ error: undefined }, formData);
    setPendingId(null);
    if (result.error) {
      setPickError(result.error);
      return;
    }
    if (slot != null && pickerId) {
      applyPick(
        {
          overall_pick: slot,
          user_id: pickerId,
          wrestler_id: wrestlerId,
          wrestler_name: byId.get(wrestlerId)?.name ?? null,
        },
        new Date().toISOString()
      );
    }
  }

  useEffect(() => {
    if (!autopick || !myTurn || slot == null || pendingId) return;
    if (autoAttemptedSlot.current === slot) return;
    const nextId = queue.find((id) => {
      if (taken.has(id)) return false;
      const wrestler = byId.get(id);
      if (!wrestler || injuredOf(wrestler.status)) return false;
      if (need && genderOf(wrestler.gender) !== need) return false;
      return true;
    });
    if (!nextId) return;
    autoAttemptedSlot.current = slot;
    const handle = window.setTimeout(() => {
      void draftWrestler(nextId);
    }, 500);
    return () => window.clearTimeout(handle);
    // draftWrestler is recreated each render; the slot guard stops a repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopick, myTurn, slot, queue, taken, need, pendingId]);

  const q = query.trim().toLowerCase();
  const visible = ranked.filter((row) => {
    if (taken.has(row.wrestler.id)) return false;
    const rowGender = genderOf(row.wrestler.gender);
    if (gender !== "all" && rowGender !== gender) return false;
    if (!brands.has(brandOf(row.wrestler.brand))) return false;
    const name = (row.wrestler.name ?? row.wrestler.id).toLowerCase();
    if (q && !name.includes(q)) return false;
    return true;
  });
  const drafting = status === "in_progress";
  const showClock = drafting && slot != null;
  const turnLabel =
    status === "completed" || status === "ready_for_review"
      ? "Draft complete"
      : myTurn
        ? autopick
          ? "Auto-pick"
          : "Your turn"
        : `${onClockName} on the clock`;

  return (
    <div className={styles.roomPage}>
      <div className={styles.status}>
        <Link
          href={`/leagues/${leagueSlug}`}
          className={styles.closeBtn}
          aria-label="Back to league"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "inherit" }}
        >
          ×
        </Link>
        <div className={styles.statusMain}>
          <div className={`${styles.turnPill} ${myTurn ? styles.turnPillYou : ""}`}>
            <span>{turnLabel}</span>
            {showClock ? <span className={styles.clock}>{formatPickClock(secondsLeft)}</span> : null}
          </div>
          <p className={styles.lastPick}>{pickError ?? lastPick}</p>
        </div>
        <div className={styles.statusActions}>
          <button
            type="button"
            className={styles.autoToggle}
            data-on={autopick ? "true" : "false"}
            aria-pressed={autopick}
            onClick={() =>
              setAutopick((on) => {
                const next = !on;
                window.sessionStorage.setItem(`live-draft-autopick:${leagueId}`, next ? "1" : "0");
                if (next) autoAttemptedSlot.current = null;
                return next;
              })
            }
          >
            Auto-pick
            <span className={styles.switch} aria-hidden />
          </button>
        </div>
      </div>

      {showAutopickNote && drafting ? (
        <div className={styles.autoBanner}>
          <span>Auto-pick is on. It uses your Big Board and skips injured wrestlers.</span>
        </div>
      ) : null}

      <div className={styles.body}>
        <div className={styles.boardScroll}>
          <div className={styles.grid} style={{ ["--teams" as string]: String(teamCount) }}>
            {teamIds.map((userId) => (
              <div
                key={`head-${userId}`}
                className={`${styles.teamHead} ${userId === viewerUserId ? styles.youHead : ""}`}
              >
                {userId === viewerUserId ? "You" : factionDisplayName(memberById.get(userId), "Manager")}
              </div>
            ))}
            {Array.from({ length: rounds }, (_, roundIdx) => {
              const round = roundIdx + 1;
              return teamIds.map((_, teamIndex) => {
                const overall = overallFor(round, teamIndex);
                const seat = order.find((row) => row.overall_pick === overall);
                if (!seat) return null;
                const pick = pickByOverall.get(overall);
                const wrestler = pick ? byId.get(pick.wrestler_id) : undefined;
                const isCurrent = overall === slot && drafting;
                const nextOverall = overall + 1;
                const nextExists = order.some((row) => row.overall_pick === nextOverall);
                const arrow = !nextExists
                  ? ""
                  : Math.floor(overall / teamCount) !== Math.floor((overall - 1) / teamCount) && overall % teamCount === 0
                    ? "↓"
                    : columnForOverall(nextOverall) > columnForOverall(overall)
                      ? "→"
                      : "←";
                const label = `${round}.${snake && round % 2 === 0 ? teamCount - teamIndex : teamIndex + 1}`;
                const wrestlerBrand = wrestler ? brandOf(wrestler.brand) : null;
                return (
                  <div
                    key={overall}
                    id={isCurrent ? "live-pick-current" : undefined}
                    className={`${styles.cell} ${wrestlerBrand ? brandClass(wrestlerBrand) : ""} ${
                      isCurrent ? styles.onClock : ""
                    } ${seat.user_id === viewerUserId && wrestler ? styles.youCell : ""}`}
                  >
                    {wrestler ? (
                      <>
                        <span className={styles.cellPick}>{label}</span>
                        <span className={styles.cellName}>{wrestler.name ?? pick?.wrestler_name}</span>
                        <span className={styles.cellMeta}>
                          {BRAND_SHORT[wrestlerBrand ?? "Other"]} · {formatPoints(pointsById.get(wrestler.id) ?? 0)}
                        </span>
                      </>
                    ) : isCurrent ? (
                      <>
                        <span className={styles.onClockLabel}>On the clock</span>
                        <span className={styles.cellPick}>{label}</span>
                      </>
                    ) : (
                      <span className={styles.cellEmpty}>{label}</span>
                    )}
                    {arrow ? (
                      <span className={styles.arrow} aria-hidden>
                        {arrow}
                      </span>
                    ) : null}
                  </div>
                );
              });
            })}
          </div>
        </div>

        <section className={styles.dock} aria-label="Draft menus">
          <div className={styles.tabs} role="tablist">
            {(
              [
                ["players", "Wrestlers"],
                ["queue", "Big Board"],
                ["team", "Team"],
                ["room", "Room"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={styles.tab}
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.dockBody} role="tabpanel">
            {tab === "players" ? (
              <>
                <select
                  className={styles.search}
                  value={pointsPeriod}
                  onChange={(event) => setPointsPeriod(event.target.value as PointsPeriod)}
                  aria-label="Points period"
                >
                  {POINTS_PERIODS.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.search}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search wrestlers"
                  aria-label="Search wrestlers"
                />
                <div className={styles.filters}>
                  <button type="button" className={styles.chip} data-on={gender === "all" ? "true" : "false"} onClick={() => setGender("all")}>
                    All
                  </button>
                  <button
                    type="button"
                    className={styles.chip}
                    data-on={gender === "F" ? "true" : "false"}
                    onClick={() => setGender((current) => (current === "F" ? "all" : "F"))}
                  >
                    Women {myWomen}/{minFemale}
                  </button>
                  <button
                    type="button"
                    className={styles.chip}
                    data-on={gender === "M" ? "true" : "false"}
                    onClick={() => setGender((current) => (current === "M" ? "all" : "M"))}
                  >
                    Men {myMen}/{minMale}
                  </button>
                  {(["Raw", "SmackDown", "NXT"] as const)
                    .filter((brand) => brand !== "NXT" || includeNxt)
                    .map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      className={styles.chip}
                      data-on={brands.has(brand) ? "true" : "false"}
                      onClick={() =>
                        setBrands((prev) => {
                          const next = new Set(prev);
                          if (next.has(brand)) next.delete(brand);
                          else next.add(brand);
                          return next;
                        })
                      }
                    >
                      {brand}
                    </button>
                  ))}
                </div>
                {canDraft && need ? (
                  <p className={styles.needBanner}>
                    This pick needs a {need === "F" ? "woman" : "man"} to meet the roster minimum.
                  </p>
                ) : null}
                {visible.map((row) => {
                  const blocked = Boolean(need && genderOf(row.wrestler.gender) !== need);
                  return (
                    <div key={row.wrestler.id} className={styles.player}>
                      <button
                        type="button"
                        className={styles.draftBtn}
                        disabled={!canDraft || blocked || pendingId != null}
                        onClick={() => void draftWrestler(row.wrestler.id)}
                      >
                        {pendingId === row.wrestler.id ? "…" : "Draft"}
                      </button>
                      <div>
                        <span className={styles.playerName}>
                          <WrestlerHeadshotImage src={row.wrestler.image_url} alt="" width={32} height={32} />
                          {row.wrestler.name ?? row.wrestler.id}
                          {injuredOf(row.wrestler.status) ? <InjuryMark /> : null}
                        </span>
                        <span className={styles.playerMeta}>
                          {BRAND_SHORT[brandOf(row.wrestler.brand)]} ·{" "}
                          {genderOf(row.wrestler.gender) === "U" ? "—" : genderOf(row.wrestler.gender)} ·{" "}
                          {formatPoints(row.points)} pts
                        </span>
                      </div>
                      <span className={styles.rank}>{row.rank}</span>
                    </div>
                  );
                })}
                {visible.length === 0 ? <p className={styles.emptyNote}>No wrestlers match these filters.</p> : null}
              </>
            ) : null}

            {tab === "queue" ? (
              <>
                <p className={styles.hint}>
                  Your Big Board. Draft from this list on your turn. Auto-pick uses it and skips anyone who is injured.
                </p>
                {queue.length === 0 ? <p className={styles.emptyNote}>Your Big Board is empty.</p> : null}
                {queue.map((id) => {
                  const wrestler = byId.get(id);
                  const takenAlready = taken.has(id);
                  const blocked = Boolean(need && genderOf(wrestler?.gender) !== need);
                  return (
                    <div key={id} className={styles.queueRow}>
                      <button
                        type="button"
                        className={styles.draftBtn}
                        disabled={!canDraft || takenAlready || blocked || !wrestler || pendingId != null}
                        onClick={() => void draftWrestler(id)}
                      >
                        {pendingId === id ? "…" : "Draft"}
                      </button>
                      <strong>
                        {wrestler?.name ?? id}
                        {injuredOf(wrestler?.status) ? <InjuryMark /> : null}
                        {takenAlready ? " · drafted" : ""}
                      </strong>
                    </div>
                  );
                })}
              </>
            ) : null}

            {tab === "room" ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {members.map((member) => {
                  const row = roomRows.find((entry) => entry.user_id === member.user_id);
                  const here = row != null && roomNow - new Date(row.last_seen_at).getTime() <= 45_000;
                  const isReady = Boolean(row?.is_ready);
                  return (
                    <li
                      key={member.user_id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 0",
                        borderTop: "1px solid var(--color-border)",
                        fontSize: 14,
                      }}
                    >
                      <strong>
                        {member.user_id === viewerUserId ? "You" : factionDisplayName(member, "Manager")}
                      </strong>
                      <span style={{ color: here ? "#0d7d0d" : "var(--color-text-muted)" }}>
                        {here ? "In the room" : "Away"}
                        {" · "}
                        {isReady ? "Ready" : "Not ready"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {tab === "team" ? (
              <>
                <div className={styles.teamSummary}>
                  <span>
                    Women {myWomen}/{minFemale}
                  </span>
                  <span>
                    Men {myMen}/{minMale}
                  </span>
                  <span>
                    {myRoster.length}/{rosterSize} picks
                  </span>
                </div>
                {teamIds.length > 0
                  ? order
                      .filter((seat) => seat.user_id === viewerUserId)
                      .map((seat) => {
                        const pick = pickByOverall.get(seat.overall_pick);
                        const wrestler = pick ? byId.get(pick.wrestler_id) : undefined;
                        const round = Math.ceil(seat.overall_pick / teamCount);
                        const pickInRound = ((seat.overall_pick - 1) % teamCount) + 1;
                        return (
                          <div key={seat.overall_pick} className={styles.teamRow}>
                            <span className={styles.pickNo}>
                              {round}.{pickInRound}
                            </span>
                            {wrestler ? (
                              <>
                                <WrestlerHeadshotImage src={wrestler.image_url} alt="" width={36} height={36} />
                                <span className={styles.teamName}>
                                  <strong>{wrestler.name}</strong>
                                  <span className={styles.playerMeta}>
                                    {BRAND_SHORT[brandOf(wrestler.brand)]} · {formatPoints(pointsById.get(wrestler.id) ?? 0)} pts
                                  </span>
                                </span>
                              </>
                            ) : (
                              <span className={styles.slotEmpty}>Empty</span>
                            )}
                          </div>
                        );
                      })
                  : null}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
