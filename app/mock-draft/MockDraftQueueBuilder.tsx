"use client";

import { useMemo, useState } from "react";
import {
  DRAFT_BIG_BOARDS,
  getAvailableBigBoardIdsForLeague,
  getBigBoardPriorityList,
  type BigBoardId,
} from "@/lib/draftBigBoards";
import { formatPoints, type MockBrand, type MockDraftWrestler } from "@/lib/mockDraftEngine";
import styles from "./mock-draft.module.css";

export type MockListSource = "custom" | BigBoardId;

type Props = {
  pool: MockDraftWrestler[];
  queue: string[];
  listSource: MockListSource;
  onSelectSource: (source: MockListSource) => void;
  onChange: (next: string[] | ((current: string[]) => string[])) => void;
};

const BRAND_SHORT: Record<MockBrand, string> = {
  Raw: "RAW",
  SmackDown: "SD",
  NXT: "NXT",
  Other: "OTHER",
};

/** Board order, limited to wrestlers who are actually in this draft pool. */
export function mockQueueFromBoard(pool: MockDraftWrestler[], boardId: BigBoardId): string[] {
  const ids = getBigBoardPriorityList(boardId) ?? [];
  const byKey = new Map(pool.map((wrestler) => [wrestler.id.toLowerCase(), wrestler.id]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const canonical = byKey.get(id.toLowerCase());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

export function MockDraftQueueBuilder({ pool, queue, listSource, onSelectSource, onChange }: Props) {
  const [query, setQuery] = useState("");
  const boardIds = useMemo(() => getAvailableBigBoardIdsForLeague({ includeNxt: true }), []);
  const byId = useMemo(() => new Map(pool.map((wrestler) => [wrestler.id, wrestler])), [pool]);
  const queued = useMemo(() => new Set(queue), [queue]);
  const q = query.trim().toLowerCase();
  const results = pool.filter((wrestler) => {
    if (queued.has(wrestler.id)) return false;
    if (!q) return true;
    return wrestler.name.toLowerCase().includes(q);
  });

  function edit(next: string[] | ((current: string[]) => string[])) {
    onSelectSource("custom");
    onChange(next);
  }

  function add(id: string) {
    edit((current) => (current.includes(id) ? current : [...current, id]));
  }

  function remove(id: string) {
    edit((current) => current.filter((queuedId) => queuedId !== id));
  }

  function move(id: string, dir: -1 | 1) {
    edit((current) => {
      const at = current.indexOf(id);
      const nextAt = at + dir;
      if (at < 0 || nextAt < 0 || nextAt >= current.length) return current;
      const next = current.slice();
      const [row] = next.splice(at, 1);
      next.splice(nextAt, 0, row);
      return next;
    });
  }

  return (
    <>
      <div className={styles.sourceList} role="radiogroup" aria-label="Priority list source">
        {boardIds.map((id) => {
          const board = DRAFT_BIG_BOARDS[id];
          const count = mockQueueFromBoard(pool, id).length;
          return (
            <label key={id} className={styles.sourceOption}>
              <input
                type="radio"
                name="mock-list-source"
                checked={listSource === id}
                onChange={() => onSelectSource(id)}
              />
              <span>
                <strong>{board.label}</strong>
                <span>
                  {" "}
                  — {count} wrestlers
                </span>
              </span>
            </label>
          );
        })}
        <label className={styles.sourceOption}>
          <input
            type="radio"
            name="mock-list-source"
            checked={listSource === "custom"}
            onChange={() => onSelectSource("custom")}
          />
          <span>
            <strong>My own list</strong>
            <span> — rank wrestlers yourself</span>
          </span>
        </label>
      </div>
      <div className={styles.queueLayout}>
      <div className={styles.queuePane}>
        <h3>Priority order {queue.length > 0 ? `(${queue.length})` : ""}</h3>
        {listSource === "custom" && queue.length > 0 ? (
          <button type="button" className={styles.textBtn} onClick={() => edit([])}>
            Clear list
          </button>
        ) : null}
        {queue.length === 0 ? (
          <p className={styles.emptyNote}>Add wrestlers in the order you want them drafted.</p>
        ) : (
          <div className={styles.queueScroll}>
            {queue.map((id, index) => {
              const wrestler = byId.get(id);
              return (
                <div key={id} className={styles.queueRow}>
                  <span className={styles.pickNo}>{index + 1}</span>
                  <strong>
                    {wrestler?.name ?? id}
                    {wrestler ? (
                      <span className={styles.playerMeta}>
                        {BRAND_SHORT[wrestler.brand]} · {formatPoints(wrestler.points)} pts
                      </span>
                    ) : null}
                  </strong>
                  <div className={styles.iconBtns}>
                    <button type="button" aria-label={`Move ${wrestler?.name ?? "wrestler"} up`} onClick={() => move(id, -1)}>
                      ↑
                    </button>
                    <button type="button" aria-label={`Move ${wrestler?.name ?? "wrestler"} down`} onClick={() => move(id, 1)}>
                      ↓
                    </button>
                    <button type="button" aria-label={`Remove ${wrestler?.name ?? "wrestler"}`} onClick={() => remove(id)}>
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.queuePane}>
        <h3>Add wrestlers</h3>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search wrestlers"
          aria-label="Search wrestlers to queue"
        />
        <div className={styles.queueScroll}>
          {results.slice(0, 60).map((wrestler) => (
            <div key={wrestler.id} className={styles.queueRow}>
              <span className={styles.pickNo}>{wrestler.rank}</span>
              <strong>
                {wrestler.name}
                <span className={styles.playerMeta}>
                  {BRAND_SHORT[wrestler.brand]} · {wrestler.gender === "F" ? "F" : wrestler.gender === "M" ? "M" : "—"} ·{" "}
                  {formatPoints(wrestler.points)} pts
                </span>
              </strong>
              <button type="button" className={styles.ghostBtn} onClick={() => add(wrestler.id)}>
                Add
              </button>
            </div>
          ))}
          {results.length === 0 ? <p className={styles.emptyNote}>No wrestlers match that search.</p> : null}
        </div>
      </div>
      </div>
    </>
  );
}
