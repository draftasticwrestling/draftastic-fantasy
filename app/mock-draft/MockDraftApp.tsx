"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBigBoardPriorityList,
  getDefaultBigBoardIdForLeague,
  type BigBoardId,
} from "@/lib/draftBigBoards";
import {
  MOCK_TEAM_MAX,
  MOCK_TEAM_MIN,
  mockRosterRules,
  type MockDraftWrestler,
} from "@/lib/mockDraftEngine";
import {
  readMockDrafts,
  upsertMockDraft,
  writeMockDrafts,
  type CpuPace,
  type SavedMockDraft,
} from "@/lib/mockDraftStorage";
import { MockDraftQueueBuilder, mockQueueFromBoard, type MockListSource } from "./MockDraftQueueBuilder";
import { MockDraftRoom } from "./MockDraftRoom";
import styles from "./mock-draft.module.css";

const CLOCKS = [30, 60, 90, 120] as const;

type Props = { pool: MockDraftWrestler[] };

export function MockDraftApp({ pool }: Props) {
  const [drafts, setDrafts] = useState<SavedMockDraft[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [teamCount, setTeamCount] = useState(4);
  const [userSlot, setUserSlot] = useState(2);
  const [clockSeconds, setClockSeconds] = useState<number>(120);
  const [cpuPace, setCpuPace] = useState<CpuPace>("fast");
  const defaultBoardId = getDefaultBigBoardIdForLeague({ includeNxt: true });
  const [listSource, setListSource] = useState<MockListSource>(defaultBoardId ?? "custom");
  const [queue, setQueue] = useState<string[]>(() =>
    defaultBoardId ? mockQueueFromBoard(pool, defaultBoardId) : []
  );

  useEffect(() => {
    setDrafts(readMockDrafts());
  }, []);

  const rules = useMemo(() => mockRosterRules(teamCount), [teamCount]);
  const active = drafts?.find((row) => row.id === activeId) ?? null;

  function selectSource(source: MockListSource) {
    setListSource(source);
    if (source === "custom") return;
    const ids = getBigBoardPriorityList(source as BigBoardId);
    setQueue(ids ? mockQueueFromBoard(pool, source) : []);
  }

  function editQueue(next: string[] | ((current: string[]) => string[])) {
    setListSource("custom");
    setQueue(next);
  }

  function save(next: SavedMockDraft) {
    setDrafts((prev) => {
      const list = upsertMockDraft(prev ?? [], next);
      writeMockDrafts(list);
      return list;
    });
  }

  function remove(id: string) {
    setDrafts((prev) => {
      const list = (prev ?? []).filter((row) => row.id !== id);
      writeMockDrafts(list);
      return list;
    });
    if (activeId === id) setActiveId(null);
  }

  function start() {
    if (!rules || pool.length === 0) return;
    const draft: SavedMockDraft = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      teamCount,
      userSlot,
      rosterSize: rules.rosterSize,
      minFemale: rules.minFemale,
      minMale: rules.minMale,
      clockSeconds,
      cpuPace,
      autopick: false,
      queue: queue.slice(),
      pickIds: Array.from({ length: teamCount * rules.rosterSize }, () => null),
      status: "drafting",
    };
    save(draft);
    setActiveId(draft.id);
  }

  if (active) {
    return (
      <MockDraftRoom
        key={active.id}
        pool={pool}
        draft={active}
        onChange={save}
        onClose={() => setActiveId(null)}
      />
    );
  }

  return (
    <div className={styles.lobbyPage}>
      <p className={styles.kicker}>Practice</p>
      <h1>Mock draft</h1>
      <p className={styles.lede}>
        Rank a priority list before you start. Auto-pick uses that queue first, then the Default Big Board when the
        list runs out. Other seats pick in this browser, and your picks stay on this device.
      </p>

      <section className={styles.setup}>
        <h2>Start a mock draft</h2>
        <p className={styles.hint}>
          Snake draft. Roster size and gender minimums follow the number of teams.
        </p>
        {pool.length === 0 ? (
          <p className={styles.needBanner}>The wrestler pool didn’t load. Refresh the page and try again.</p>
        ) : null}
        <div className={styles.fields}>
          <div className={styles.field}>
            <span id="mock-teams-label">Teams</span>
            <div className={styles.choiceRow} role="radiogroup" aria-labelledby="mock-teams-label">
              {Array.from({ length: MOCK_TEAM_MAX - MOCK_TEAM_MIN + 1 }, (_, i) => MOCK_TEAM_MIN + i).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={teamCount === n}
                  className={styles.choice}
                  onClick={() => {
                    setTeamCount(n);
                    setUserSlot((slot) => Math.min(slot, n));
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <span id="mock-slot-label">Your slot</span>
            <div className={styles.choiceRow} role="radiogroup" aria-labelledby="mock-slot-label">
              {Array.from({ length: teamCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={userSlot === n}
                  className={styles.choice}
                  onClick={() => setUserSlot(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <span id="mock-clock-label">Your pick clock</span>
            <div className={styles.choiceRow} role="radiogroup" aria-labelledby="mock-clock-label">
              {CLOCKS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={clockSeconds === n}
                  className={styles.choice}
                  onClick={() => setClockSeconds(n)}
                >
                  {n === 120 ? "2 min" : `${n}s`}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <span id="mock-pace-label">Computer pace</span>
            <div className={styles.choiceRow} role="radiogroup" aria-labelledby="mock-pace-label">
              <button
                type="button"
                role="radio"
                aria-checked={cpuPace === "fast"}
                className={styles.choice}
                onClick={() => setCpuPace("fast")}
              >
                Fast, about a second
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={cpuPace === "clock"}
                className={styles.choice}
                onClick={() => setCpuPace("clock")}
              >
                Same clock as you
              </button>
            </div>
          </div>
        </div>
        {rules ? (
          <p className={styles.rulesLine}>
            {rules.rosterSize} rounds · {teamCount * rules.rosterSize} picks · at least {rules.minFemale} women and{" "}
            {rules.minMale} men
          </p>
        ) : null}
      </section>

      <section className={styles.setup}>
        <div className={styles.queueHeader}>
          <div>
            <h2>Your queue</h2>
            <p className={styles.hint}>
              Start from a Big Board, or build your own list. Auto-pick and the clock use this order first, then the
              Default Big Board when it runs out. Change the order and it becomes your list.
            </p>
          </div>
          <button type="button" className={styles.primary} onClick={start} disabled={!rules || pool.length === 0}>
            Start mock draft
          </button>
        </div>
        <MockDraftQueueBuilder
          pool={pool}
          queue={queue}
          listSource={listSource}
          onSelectSource={selectSource}
          onChange={editQueue}
        />
      </section>

      <section className={styles.saved}>
        <h2>Your mock drafts</h2>
        {drafts == null ? null : drafts.length === 0 ? (
          <p className={styles.emptyNote}>Finished and in-progress mocks show up here on this browser.</p>
        ) : (
          <ul className={styles.savedList}>
            {drafts.map((draft) => {
              const when = new Date(draft.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <li key={draft.id} className={styles.savedItem}>
                  <div>
                    <h3>
                      {draft.teamCount}-team snake
                    </h3>
                    <p>
                      Slot {draft.userSlot} · {draft.rosterSize} rounds · {when}
                    </p>
                  </div>
                  <div className={styles.savedActions}>
                    <span className={`${styles.pill} ${draft.status === "drafting" ? styles.pillLive : styles.pillDone}`}>
                      {draft.status === "drafting" ? "Drafting" : "Complete"}
                    </span>
                    <button type="button" className={styles.ghostBtn} onClick={() => setActiveId(draft.id)}>
                      {draft.status === "drafting" ? "Resume" : "Open"}
                    </button>
                    <button type="button" className={styles.textBtn} onClick={() => remove(draft.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
