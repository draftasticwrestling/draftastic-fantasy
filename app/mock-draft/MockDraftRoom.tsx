"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WrestlerHeadshotImage from "@/app/components/WrestlerHeadshotImage";
import { getDefaultBigBoardIdForLeague } from "@/lib/draftBigBoards";
import {
  buildSnakePicks,
  chooseWrestler,
  type SnakePick,
  cpuStyleForTeam,
  currentPickIndex,
  draftedIdSet,
  fillCpuUntilUser,
  fillRemainingPicks,
  formatPickClock,
  formatPoints,
  genderNeeded,
  rosterForTeam,
  type MockBrand,
  type MockDraftWrestler,
  type MockGender,
} from "@/lib/mockDraftEngine";
import type { SavedMockDraft } from "@/lib/mockDraftStorage";
import { mockQueueFromBoard } from "./MockDraftQueueBuilder";
import styles from "./mock-draft.module.css";

type Tab = "players" | "queue" | "team";

type Props = {
  pool: MockDraftWrestler[];
  draft: SavedMockDraft;
  onChange: (draft: SavedMockDraft) => void;
  onClose: () => void;
};

const BRAND_SHORT: Record<MockBrand, string> = {
  Raw: "RAW",
  SmackDown: "SD",
  NXT: "NXT",
  Other: "OTHER",
};

function brandClass(brand: MockBrand): string {
  if (brand === "Raw") return styles.raw;
  if (brand === "SmackDown") return styles.sd;
  if (brand === "NXT") return styles.nxt;
  return styles.other;
}

function genderWord(gender: "M" | "F"): string {
  return gender === "F" ? "woman" : "man";
}

export function MockDraftRoom({ pool, draft, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(draft.status === "complete" ? "team" : "players");
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<"all" | MockGender>("all");
  const [brands, setBrands] = useState<Set<MockBrand>>(
    () => new Set(["Raw", "SmackDown", "NXT", "Other"])
  );
  const [secondsLeft, setSecondsLeft] = useState(draft.clockSeconds);
  const [menuPick, setMenuPick] = useState<SnakePick | null>(null);
  const [assigningOverall, setAssigningOverall] = useState<number | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const userTeam = draft.userSlot - 1;
  const defaultQueue = useMemo(() => {
    const boardId = getDefaultBigBoardIdForLeague({ includeNxt: true });
    return boardId ? mockQueueFromBoard(pool, boardId) : [];
  }, [pool]);
  const rules = useMemo(
    () => ({
      rosterSize: draft.rosterSize,
      minFemale: draft.minFemale,
      minMale: draft.minMale,
    }),
    [draft.rosterSize, draft.minFemale, draft.minMale]
  );
  const snake = useMemo(
    () => buildSnakePicks(draft.teamCount, draft.rosterSize),
    [draft.teamCount, draft.rosterSize]
  );
  const byId = useMemo(() => new Map(pool.map((w) => [w.id, w])), [pool]);
  const idx = currentPickIndex(draft.pickIds);
  const seat = idx >= 0 ? snake[idx] : undefined;
  const myTurn = draft.status === "drafting" && seat?.teamIndex === userTeam && !draft.autopick;
  const roster = useMemo(
    () => rosterForTeam(draft.pickIds, snake, userTeam, byId),
    [draft.pickIds, snake, userTeam, byId]
  );
  const userPicks = useMemo(() => snake.filter((p) => p.teamIndex === userTeam), [snake, userTeam]);
  const need = genderNeeded(rules, roster);
  const women = roster.filter((w) => w.gender === "F").length;
  const men = roster.filter((w) => w.gender === "M").length;

  const lastPick = useMemo(() => {
    for (let i = draft.pickIds.length - 1; i >= 0; i--) {
      const id = draft.pickIds[i];
      if (!id) continue;
      const pick = snake[i];
      const wrestler = byId.get(id);
      if (!pick || !wrestler) continue;
      const who = pick.teamIndex === userTeam ? "You" : `Team ${pick.teamIndex + 1}`;
      return `${who} drafted ${wrestler.name}`;
    }
    return "Snake draft · 2026 points";
  }, [draft.pickIds, snake, byId, userTeam]);

  const statusRef = useRef(draft.status);
  useEffect(() => {
    if (statusRef.current !== "complete" && draft.status === "complete") setTab("team");
    statusRef.current = draft.status;
  }, [draft.status]);

  useEffect(() => {
    if (draft.status !== "drafting" || idx < 0) return;
    const seatNow = snake[idx];
    if (!seatNow) return;
    const isUser = seatNow.teamIndex === userTeam;
    const timed = isUser ? !draft.autopick : draft.cpuPace === "clock";
    const delay = isUser ? 700 : 900;
    let timeoutId = 0;
    let intervalId = 0;

    const take = () => {
      const latest = draftRef.current;
      if (latest.status !== "drafting") return;
      if (latest.pickIds[idx] != null) return;
      const latestSeat = snake[idx];
      if (!latestSeat) return;
      const drafted = draftedIdSet(latest.pickIds);
      const teamRoster = rosterForTeam(latest.pickIds, snake, latestSeat.teamIndex, byId);
      const userTurn = latestSeat.teamIndex === userTeam;
      const wrestlerId = chooseWrestler({
        pool,
        draftedIds: drafted,
        roster: teamRoster,
        rules,
        style: userTurn ? "best" : cpuStyleForTeam(latestSeat.teamIndex),
        queue: latest.queue,
        fallbackQueue: defaultQueue,
        useQueue: userTurn,
      });
      if (!wrestlerId) return;
      const pickIds = latest.pickIds.slice();
      pickIds[idx] = wrestlerId;
      const done = pickIds.every((id) => id != null);
      onChangeRef.current({
        ...latest,
        pickIds,
        queue: latest.queue.filter((id) => id !== wrestlerId),
        status: done ? "complete" : "drafting",
      });
    };

    if (!timed) {
      timeoutId = window.setTimeout(take, delay);
      return () => window.clearTimeout(timeoutId);
    }

    const started = Date.now();
    setSecondsLeft(draft.clockSeconds);
    intervalId = window.setInterval(() => {
      const left = draft.clockSeconds - Math.floor((Date.now() - started) / 1000);
      if (left <= 0) {
        window.clearInterval(intervalId);
        setSecondsLeft(0);
        take();
      } else {
        setSecondsLeft(left);
      }
    }, 200);
    return () => window.clearInterval(intervalId);
  }, [
    byId,
    draft.autopick,
    draft.clockSeconds,
    draft.cpuPace,
    draft.status,
    idx,
    defaultQueue,
    pool,
    rules,
    snake,
    userTeam,
  ]);

  useEffect(() => {
    document.getElementById("mock-pick-current")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [idx]);

  useEffect(() => {
    if (menuPick && draft.pickIds[menuPick.overall - 1] != null) setMenuPick(null);
    if (assigningOverall != null && draft.pickIds[assigningOverall - 1] != null) setAssigningOverall(null);
  }, [assigningOverall, draft.pickIds, menuPick]);

  function commitAt(slotIndex: number, wrestlerId: string) {
    const latest = draftRef.current;
    if (slotIndex < 0 || latest.pickIds[slotIndex] != null) return;
    if (draftedIdSet(latest.pickIds).has(wrestlerId)) return;
    const pickIds = latest.pickIds.slice();
    pickIds[slotIndex] = wrestlerId;
    const done = pickIds.every((id) => id != null);
    onChange({
      ...latest,
      pickIds,
      queue: latest.queue.filter((id) => id !== wrestlerId),
      status: done ? "complete" : "drafting",
    });
    setAssigningOverall(null);
    setMenuPick(null);
  }

  const assignPick = assigningOverall != null ? snake[assigningOverall - 1] : undefined;
  const assignNeed = assignPick
    ? genderNeeded(rules, rosterForTeam(draft.pickIds, snake, assignPick.teamIndex, byId))
    : null;

  function draftWrestler(wrestlerId: string) {
    const slotIndex = assignPick ? assignPick.overall - 1 : idx;
    const slotNeed = assignPick ? assignNeed : need;
    if (!assignPick && !myTurn) return;
    if (slotIndex < 0) return;
    if (slotNeed && byId.get(wrestlerId)?.gender !== slotNeed) return;
    commitAt(slotIndex, wrestlerId);
  }

  function cpuFillSlot(pick: SnakePick) {
    const slotIndex = pick.overall - 1;
    const seat = snake[slotIndex];
    if (!seat || draft.pickIds[slotIndex] != null) {
      setMenuPick(null);
      return;
    }
    const wrestlerId = chooseWrestler({
      pool,
      draftedIds: draftedIdSet(draft.pickIds),
      roster: rosterForTeam(draft.pickIds, snake, seat.teamIndex, byId),
      rules,
      style: seat.teamIndex === userTeam ? "best" : cpuStyleForTeam(seat.teamIndex),
      queue: draft.queue,
      fallbackQueue: defaultQueue,
      useQueue: seat.teamIndex === userTeam,
    });
    if (wrestlerId) commitAt(slotIndex, wrestlerId);
    else setMenuPick(null);
  }

  function toggleQueue(wrestlerId: string) {
    const queue = draft.queue.includes(wrestlerId)
      ? draft.queue.filter((id) => id !== wrestlerId)
      : [...draft.queue, wrestlerId];
    onChange({ ...draft, queue });
  }

  function moveQueue(wrestlerId: string, dir: -1 | 1) {
    const at = draft.queue.indexOf(wrestlerId);
    const nextAt = at + dir;
    if (at < 0 || nextAt < 0 || nextAt >= draft.queue.length) return;
    const queue = draft.queue.slice();
    const [row] = queue.splice(at, 1);
    queue.splice(nextAt, 0, row);
    onChange({ ...draft, queue });
  }

  function skipToMe() {
    onChange({ ...draft, pickIds: fillCpuUntilUser({ pickIds: draft.pickIds, snake, userTeam, pool, rules }) });
  }

  function simToEnd() {
    const filled = fillRemainingPicks({
      pickIds: draft.pickIds,
      snake,
      userTeam,
      pool,
      rules,
      queue: draft.queue,
      fallbackQueue: defaultQueue,
    });
    const done = filled.pickIds.every((id) => id != null);
    onChange({ ...draft, pickIds: filled.pickIds, queue: filled.queue, status: done ? "complete" : "drafting" });
  }

  const drafted = draftedIdSet(draft.pickIds);
  const q = query.trim().toLowerCase();
  const visible = pool.filter((w) => {
    if (drafted.has(w.id)) return false;
    if (gender !== "all" && w.gender !== gender) return false;
    if (!brands.has(w.brand)) return false;
    if (q && !w.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const queueIds = new Set(draft.queue);
  const rounds = draft.rosterSize;
  const showClock = draft.status === "drafting" && (myTurn || (seat && seat.teamIndex !== userTeam && draft.cpuPace === "clock"));
  const turnLabel =
    draft.status === "complete"
      ? "Draft complete"
      : myTurn
        ? "Your turn"
        : draft.autopick && seat?.teamIndex === userTeam
          ? "Auto-pick"
          : `Team ${(seat?.teamIndex ?? 0) + 1} on the clock`;

  return (
    <div className={styles.roomPage}>
      <div className={styles.status}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Back to mock drafts">
          ×
        </button>
        <div className={styles.statusMain}>
          <div className={`${styles.turnPill} ${myTurn ? styles.turnPillYou : ""}`}>
            <span>{turnLabel}</span>
            {showClock ? <span className={styles.clock}>{formatPickClock(secondsLeft)}</span> : null}
          </div>
          <p className={styles.lastPick}>{lastPick}</p>
        </div>
        <div className={styles.statusActions}>
          {draft.status === "drafting" && seat && seat.teamIndex !== userTeam ? (
            <button type="button" className={styles.ghostBtn} onClick={skipToMe}>
              Skip to me
            </button>
          ) : null}
          {draft.status === "drafting" ? (
            <button type="button" className={styles.ghostBtn} onClick={simToEnd}>
              Sim to end
            </button>
          ) : null}
          <button
            type="button"
            className={styles.autoToggle}
            data-on={draft.autopick ? "true" : "false"}
            aria-pressed={draft.autopick}
            onClick={() => onChange({ ...draft, autopick: !draft.autopick })}
          >
            Auto-pick
            <span className={styles.switch} aria-hidden />
          </button>
        </div>
      </div>

      {draft.autopick && draft.status === "drafting" ? (
        <div className={styles.autoBanner}>
          <span>You are on auto-pick.</span>
          <button type="button" onClick={() => onChange({ ...draft, autopick: false })}>
            Turn off
          </button>
        </div>
      ) : null}

      <div className={styles.body}>
        <div className={styles.boardScroll}>
          <div className={styles.grid} style={{ ["--teams" as string]: draft.teamCount }}>
            {Array.from({ length: draft.teamCount }, (_, teamIndex) => (
              <div
                key={`head-${teamIndex}`}
                className={`${styles.teamHead} ${teamIndex === userTeam ? styles.youHead : ""}`}
              >
                {teamIndex === userTeam ? "You" : `Team ${teamIndex + 1}`}
              </div>
            ))}
            {Array.from({ length: rounds }, (_, roundIdx) => {
              const round = roundIdx + 1;
              return Array.from({ length: draft.teamCount }, (_, teamIndex) => {
                const pick = snake.find((p) => p.round === round && p.teamIndex === teamIndex);
                if (!pick) return null;
                const wrestlerId = draft.pickIds[pick.overall - 1];
                const wrestler = wrestlerId ? byId.get(wrestlerId) : undefined;
                const isCurrent = pick.overall - 1 === idx && draft.status === "drafting";
                const next = snake[pick.overall];
                const arrow =
                  !next ? "" : next.round !== pick.round ? "↓" : next.teamIndex > pick.teamIndex ? "→" : "←";
                const label = `${pick.round}.${pick.pickInRound}`;
                const openable = !wrestler && draft.status === "drafting";
                const cellClass = `${styles.cell} ${wrestler ? brandClass(wrestler.brand) : ""} ${
                  isCurrent ? styles.onClock : ""
                } ${teamIndex === userTeam && wrestler ? styles.youCell : ""} ${openable ? styles.cellButton : ""}`;
                const inner = (
                  <>
                    {wrestler ? (
                      <>
                        <span className={styles.cellPick}>{label}</span>
                        <span className={styles.cellName}>{wrestler.name}</span>
                        <span className={styles.cellMeta}>
                          {BRAND_SHORT[wrestler.brand]} · {formatPoints(wrestler.points)}
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
                  </>
                );
                if (openable) {
                  return (
                    <button
                      key={pick.overall}
                      type="button"
                      id={isCurrent ? "mock-pick-current" : undefined}
                      className={cellClass}
                      aria-label={`Empty slot ${label}`}
                      onClick={() => setMenuPick(pick)}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div
                    key={pick.overall}
                    id={isCurrent ? "mock-pick-current" : undefined}
                    className={cellClass}
                  >
                    {inner}
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
                ["players", "Players"],
                ["queue", "Queue"],
                ["team", "Team"],
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
                {id === "queue" && draft.queue.length > 0 ? ` ${draft.queue.length}` : ""}
              </button>
            ))}
          </div>
          <div className={styles.dockBody} role="tabpanel">
            {tab === "players" ? (
              <>
                <input
                  className={styles.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search wrestlers"
                  aria-label="Search wrestlers"
                />
                <div className={styles.filters}>
                  <button
                    type="button"
                    className={styles.chip}
                    data-on={gender === "all" ? "true" : "false"}
                    onClick={() => setGender("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={styles.chip}
                    data-on={gender === "F" ? "true" : "false"}
                    onClick={() => setGender((g) => (g === "F" ? "all" : "F"))}
                  >
                    Women {women}/{draft.minFemale}
                  </button>
                  <button
                    type="button"
                    className={styles.chip}
                    data-on={gender === "M" ? "true" : "false"}
                    onClick={() => setGender((g) => (g === "M" ? "all" : "M"))}
                  >
                    Men {men}/{draft.minMale}
                  </button>
                  {(["Raw", "SmackDown", "NXT"] as const).map((brand) => (
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
                      {brand === "SmackDown" ? "SmackDown" : brand}
                    </button>
                  ))}
                </div>
                {((assignPick && assignNeed) || (!assignPick && myTurn && need)) ? (
                  <p className={styles.needBanner}>
                    This pick needs a {genderWord((assignPick ? assignNeed : need) as "M" | "F")} to meet the roster minimum.
                  </p>
                ) : null}
                {visible.map((w) => {
                  const slotNeed = assignPick ? assignNeed : need;
                  const choosing = Boolean(assignPick) || myTurn;
                  const blocked = Boolean(slotNeed && w.gender !== slotNeed);
                  return (
                    <div key={w.id} className={styles.player}>
                      <button
                        type="button"
                        className={styles.draftBtn}
                        disabled={!choosing || blocked}
                        onClick={() => draftWrestler(w.id)}
                      >
                        Draft
                      </button>
                      <div>
                        <span className={styles.playerName}>
                          <WrestlerHeadshotImage src={w.imageUrl} alt="" width={32} height={32} />
                          {w.name}
                          {w.injured ? (
                            <span className={styles.injury} role="img" aria-label="Injured">
                              +
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.playerMeta}>
                          {BRAND_SHORT[w.brand]} · {w.gender === "F" ? "F" : w.gender === "M" ? "M" : "—"} ·{" "}
                          {formatPoints(w.points)} pts
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span className={styles.rank}>{w.rank}</span>
                        <button
                          type="button"
                          className={styles.queueBtn}
                          data-on={queueIds.has(w.id) ? "true" : "false"}
                          aria-label={queueIds.has(w.id) ? `Remove ${w.name} from queue` : `Add ${w.name} to queue`}
                          onClick={() => toggleQueue(w.id)}
                        >
                          {queueIds.has(w.id) ? "✓" : "+"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {visible.length === 0 ? <p className={styles.emptyNote}>No wrestlers match these filters.</p> : null}
              </>
            ) : null}

            {tab === "queue" ? (
              <>
                <p className={styles.hint}>
                  Your priority list. Auto-pick and the clock take the next wrestler still available here. When this list runs out, they use the Default Big Board.
                </p>
                {draft.queue.length === 0 ? <p className={styles.emptyNote}>Your queue is empty.</p> : null}
                {draft.queue.map((id, queueIndex) => {
                  const wrestler = byId.get(id);
                  const taken = drafted.has(id);
                  return (
                    <div key={id} className={styles.queueRow}>
                      <span className={styles.pickNo}>{queueIndex + 1}</span>
                      <strong>
                        {wrestler?.name ?? id}
                        {taken ? " · drafted" : ""}
                      </strong>
                      <div className={styles.iconBtns}>
                        <button type="button" aria-label="Move up" onClick={() => moveQueue(id, -1)}>
                          ↑
                        </button>
                        <button type="button" aria-label="Move down" onClick={() => moveQueue(id, 1)}>
                          ↓
                        </button>
                        <button type="button" aria-label="Remove from queue" onClick={() => toggleQueue(id)}>
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : null}

            {tab === "team" ? (
              <>
                <div className={styles.teamSummary}>
                  <span>
                    Women {women}/{draft.minFemale}
                  </span>
                  <span>
                    Men {men}/{draft.minMale}
                  </span>
                  <span>
                    {roster.length}/{draft.rosterSize} picks
                  </span>
                </div>
                {Array.from({ length: draft.rosterSize }, (_, rosterIndex) => {
                  const slot = userPicks[rosterIndex];
                  const wrestlerId = slot ? draft.pickIds[slot.overall - 1] : null;
                  const wrestler = wrestlerId ? byId.get(wrestlerId) : undefined;
                  return (
                    <div key={rosterIndex} className={styles.teamRow}>
                      <span className={styles.pickNo}>{slot ? `${slot.round}.${slot.pickInRound}` : ""}</span>
                      {wrestler ? (
                        <>
                          <WrestlerHeadshotImage src={wrestler.imageUrl} alt="" width={36} height={36} />
                          <span className={styles.teamName}>
                            <strong>{wrestler.name}</strong>
                            <span className={styles.playerMeta}>
                              {BRAND_SHORT[wrestler.brand]} · {formatPoints(wrestler.points)} pts
                            </span>
                          </span>
                        </>
                      ) : (
                        <span className={styles.slotEmpty}>Empty</span>
                      )}
                    </div>
                  );
                })}
              </>
            ) : null}
          </div>
          {assignPick ? (
            <div className={styles.assignBar}>
              <span>
                Set player for pick {assignPick.round}.{assignPick.pickInRound}
              </span>
              <button type="button" onClick={() => setAssigningOverall(null)}>
                Cancel
              </button>
            </div>
          ) : null}
        </section>
      </div>
      {menuPick ? (
        <div className={styles.slotBackdrop} onClick={() => setMenuPick(null)}>
          <div
            className={styles.slotModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-menu-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="slot-menu-title">
              Empty slot. Pick {menuPick.round}.{menuPick.pickInRound}
            </p>
            <p className={styles.slotModalWho}>
              {menuPick.teamIndex === userTeam ? "You" : `Team ${menuPick.teamIndex + 1}`}
            </p>
            <button
              type="button"
              onClick={() => {
                setAssigningOverall(menuPick.overall);
                setMenuPick(null);
                setTab("players");
              }}
            >
              Manually set player
            </button>
            <button type="button" onClick={() => cpuFillSlot(menuPick)}>
              Let CPU auto-pick
            </button>
            <button type="button" onClick={() => setMenuPick(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
