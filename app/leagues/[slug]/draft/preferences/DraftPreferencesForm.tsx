"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveDraftPreferencesFormAction } from "../actions";
import {
  AUTOPICK_REQUIRED_FEMALE_COUNT,
  AUTOPICK_LIST_EXHAUSTED_TIE_BREAK,
} from "@/lib/draftPriorityRequirements";
import { BIG_BOARD_IDS, DRAFT_BIG_BOARDS, getBigBoardPriorityList, type BigBoardId } from "@/lib/draftBigBoards";

const OTHER_BIG_BOARD_IDS = BIG_BOARD_IDS.filter((id): id is BigBoardId => id !== "default");
import { normalizeDraftPoolGender } from "@/lib/wrestlerDraftGender";

const MIN_PRIORITY = 10;
/** Case-insensitive id key so priority_list slugs match DB `wrestlers.id` casing. */
function wrestlerIdKey(id: string | null | undefined): string {
  return String(id ?? "").trim().toLowerCase();
}

function buildWrestlerLookup(pool: WrestlerOption[]): Map<string, WrestlerOption> {
  const m = new Map<string, WrestlerOption>();
  for (const w of pool) {
    if (w.id == null || String(w.id).trim() === "") continue;
    const raw = String(w.id).trim();
    m.set(raw, w);
    m.set(raw.toLowerCase(), w);
  }
  return m;
}

function optionForPriorityId(lookup: Map<string, WrestlerOption>, priorityId: string): WrestlerOption | undefined {
  const k = String(priorityId).trim();
  return lookup.get(k) ?? lookup.get(k.toLowerCase());
}

function priorityListContainsId(list: readonly string[], wrestlerId: string): boolean {
  const key = wrestlerIdKey(wrestlerId);
  return list.some((x) => wrestlerIdKey(x) === key);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "12px 24px",
        background: "var(--color-blue, #1a73e8)",
        color: "#fff",
        border: "none",
        borderRadius: "var(--radius)",
        fontSize: 16,
        fontWeight: 600,
        cursor: pending ? "default" : "pointer",
        alignSelf: "flex-start",
      }}
    >
      {pending ? "Saving…" : "Save preferences"}
    </button>
  );
}

function normalizeSearch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type WrestlerOption = {
  id: string;
  name: string | null;
  gender?: string | null;
  brand?: string | null;
  rating2k?: number | null;
  dob?: string | null;
};

function canonicalBrand(brand: string | null | undefined): "RAW" | "SmackDown" | "NXT" | null {
  const value = String(brand ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("raw")) return "RAW";
  if (value.includes("smack")) return "SmackDown";
  if (value.includes("nxt")) return "NXT";
  return null;
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - d.getUTCMonth();
  const dayDiff = now.getUTCDate() - d.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age >= 0 && age <= 100 ? age : null;
}

function wrestlerDetailLine(w: WrestlerOption): string {
  const brand = canonicalBrand(w.brand) ?? "—";
  const rating = typeof w.rating2k === "number" && Number.isFinite(w.rating2k) ? String(Math.round(w.rating2k)) : "—";
  const age = ageFromDob(w.dob);
  return `Roster: ${brand} · 2K: ${rating} · Age: ${age != null ? age : "—"}`;
}

type Props = {
  leagueSlug: string;
  wrestlerOptions: WrestlerOption[];
  initialPriorityList: string[];
  /** Autopick: which Big Board is selected, or "custom" (including after editing a board). */
  initialListSource?: "custom" | BigBoardId;
  /** When true, show Big Board shortcuts and require 50+ / 16+ female for a custom list. */
  isAutopickLeague?: boolean;
  autopickRequiredPriorityCount?: number;
  availableBigBoardIds?: BigBoardId[];
  disabled?: boolean;
  fromOnboarding?: boolean;
};

export function DraftPreferencesForm({
  leagueSlug,
  wrestlerOptions,
  initialPriorityList,
  initialListSource = "custom",
  isAutopickLeague = false,
  autopickRequiredPriorityCount = 50,
  availableBigBoardIds = [...BIG_BOARD_IDS],
  disabled = false,
  fromOnboarding = false,
}: Props) {
  const minPreferred = isAutopickLeague ? autopickRequiredPriorityCount : MIN_PRIORITY;
  const availableBoardSet = useMemo(() => new Set<BigBoardId>(availableBigBoardIds), [availableBigBoardIds]);
  const hasProvidedBoards = availableBigBoardIds.length > 0;
  const availableOtherBoardIds = useMemo(
    () => OTHER_BIG_BOARD_IDS.filter((id) => availableBoardSet.has(id)),
    [availableBoardSet]
  );
  const [listSource, setListSource] = useState<"custom" | BigBoardId>(() =>
    isAutopickLeague && initialListSource !== "custom" && availableBoardSet.has(initialListSource)
      ? initialListSource
      : "custom"
  );
  const defaultBoardIds = availableBoardSet.has("default") ? getBigBoardPriorityList("default") ?? [] : [];
  const [priorityList, setPriorityList] = useState<string[]>(initialPriorityList);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const router = useRouter();
  const priorityListInputRef = useRef<HTMLInputElement>(null);
  const [formState, formAction] = useActionState(
    saveDraftPreferencesFormAction,
    null as { error?: string; redirectTo?: string } | null
  );

  useEffect(() => {
    if (priorityListInputRef.current) {
      priorityListInputRef.current.value = JSON.stringify(priorityList);
    }
  }, [priorityList]);

  useEffect(() => {
    if (formState != null && !formState.error) {
      if (formState.redirectTo) {
        router.push(formState.redirectTo);
        return;
      }
      setMessage({
        type: "success",
        text: fromOnboarding ? "Preferences saved. Return to league setup to finish." : "Preferences saved.",
      });
      router.refresh();
    } else if (formState?.error) {
      setMessage({ type: "error", text: formState.error });
    }
  }, [formState, fromOnboarding, router]);

  const wrestlerLookup = useMemo(() => buildWrestlerLookup(wrestlerOptions), [wrestlerOptions]);
  const availableToAdd = useMemo(
    () => wrestlerOptions.filter((w) => !priorityListContainsId(priorityList, w.id)),
    [wrestlerOptions, priorityList]
  );
  const searchNorm = normalizeSearch(searchQuery);
  const searchResults = useMemo(() => {
    if (!searchNorm) return availableToAdd.slice(0, 50);
    const q = searchNorm;
    return availableToAdd.filter((w) => {
      const name = (w.name || "").toLowerCase();
      const id = (w.id || "").toLowerCase();
      const brand = (w.brand || "").toLowerCase();
      return name.includes(q) || id.includes(q) || brand.includes(q) || name.replace(/-/g, " ").includes(q);
    }).slice(0, 50);
  }, [availableToAdd, searchNorm]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (e.target instanceof Node && searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= searchResults.length) setHighlightedIndex(Math.max(0, searchResults.length - 1));
  }, [searchResults.length, highlightedIndex]);

  const markCustomOnListEdit = () => {
    setListSource((prev) => (prev !== "custom" ? "custom" : prev));
  };

  const addWrestlerById = (id: string) => {
    if (!id || priorityListContainsId(priorityList, id)) return;
    markCustomOnListEdit();
    const canonical = optionForPriorityId(wrestlerLookup, id)?.id ?? id;
    setPriorityList((prev) => [...prev, canonical]);
    setSearchQuery("");
    setSearchOpen(false);
    setHighlightedIndex(0);
  };

  const removeWrestler = (index: number) => {
    markCustomOnListEdit();
    setPriorityList((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    markCustomOnListEdit();
    setPriorityList((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= priorityList.length - 1) return;
    markCustomOnListEdit();
    setPriorityList((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.setData("application/json", JSON.stringify({ index }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedIndex(null);
    const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(dragIndex) || dragIndex === dropIndex) return;
    markCustomOnListEdit();
    setPriorityList((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      const insertAt = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
      next.splice(insertAt, 0, removed);
      return next;
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen || searchResults.length === 0) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % searchResults.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const w = searchResults[highlightedIndex];
      if (w) addWrestlerById(w.id);
      return;
    }
    if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    setMessage(null);
    if (listSource !== "custom") return;

    if (priorityList.length === 0) {
      if (isAutopickLeague) {
        e.preventDefault();
        setMessage({ type: "error", text: "Add your ranked list or choose a Big Board above." });
      }
      return;
    }

    if (isAutopickLeague) {
      if (priorityList.length < autopickRequiredPriorityCount) {
        e.preventDefault();
        setMessage({
          type: "error",
          text: `Autopick needs at least ${autopickRequiredPriorityCount} wrestlers on your list (currently ${priorityList.length}).`,
        });
        return;
      }
      const femaleCount = priorityList.reduce(
        (n, id) => n + (normalizeDraftPoolGender(optionForPriorityId(wrestlerLookup, id)?.gender) === "F" ? 1 : 0),
        0
      );
      if (femaleCount < AUTOPICK_REQUIRED_FEMALE_COUNT) {
        e.preventDefault();
        setMessage({
          type: "error",
          text: `Autopick needs at least ${AUTOPICK_REQUIRED_FEMALE_COUNT} female wrestlers on your list (currently ${femaleCount}).`,
        });
        return;
      }
      return;
    }

    if (priorityList.length < MIN_PRIORITY) {
      e.preventDefault();
      setMessage({
        type: "error",
        text: `Preferred wrestlers list must have at least ${MIN_PRIORITY} wrestlers when set.`,
      });
    }
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <input type="hidden" name="league_slug" value={leagueSlug} />
      {fromOnboarding ? <input type="hidden" name="from_onboarding" value="1" /> : null}
      <input type="hidden" name="list_source" value={listSource} />
      <input ref={priorityListInputRef} type="hidden" name="priority_list" defaultValue={JSON.stringify(priorityList)} />
      {isAutopickLeague && hasProvidedBoards && (
        <section>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text)" }}>
            Priority list source
            <span style={{ color: "var(--color-success, #0d7d0d)", fontSize: 14, fontWeight: 500 }}>
              {" "}
              (updated 4/26/26)
            </span>
          </h2>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Everyone defaults to the site <strong>Default Big Board</strong> until you deliberately choose another provided Big Board or{" "}
            <strong>My own list</strong> and save. If you reorder, add, or remove anyone after choosing a board, your source becomes{" "}
            <strong>My own list</strong> with your edits. <strong>Tie-break after your list runs out</strong> (same for everyone):{" "}
            {AUTOPICK_LIST_EXHAUSTED_TIE_BREAK}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="list_source_ui"
                checked={listSource === "default"}
                onChange={() => {
                  setListSource("default");
                  setPriorityList([...defaultBoardIds]);
                }}
                disabled={disabled}
                style={{ width: 18, height: 18, marginTop: 2 }}
              />
              <span>
                <strong>{DRAFT_BIG_BOARDS.default.label}</strong>
                <span style={{ color: "var(--color-text-muted)" }}> — {defaultBoardIds.length} wrestlers (recommended default)</span>
              </span>
            </label>
            {availableOtherBoardIds.map((id) => {
              const board = DRAFT_BIG_BOARDS[id];
              const ids = getBigBoardPriorityList(id);
              const ready = Boolean(ids && ids.length >= autopickRequiredPriorityCount);
              return (
                <label
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 14,
                    cursor: disabled || !ready ? "default" : "pointer",
                    opacity: ready ? 1 : 0.55,
                  }}
                >
                  <input
                    type="radio"
                    name="list_source_ui"
                    checked={listSource === id}
                    onChange={() => {
                      setListSource(id);
                      setPriorityList([...(getBigBoardPriorityList(id) ?? [])]);
                    }}
                    disabled={disabled || !ready}
                    style={{ width: 18, height: 18, marginTop: 2 }}
                  />
                  <span>
                    <strong>{board.label}</strong>
                    {!ready ? (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {" "}
                        — not available yet (needs {autopickRequiredPriorityCount}+ IDs in code).
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}> — {board.wrestlerIds.length} wrestlers</span>
                    )}
                  </span>
                </label>
              );
            })}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="list_source_ui"
                checked={listSource === "custom"}
                onChange={() => {
                  setListSource("custom");
                }}
                disabled={disabled}
                style={{ width: 18, height: 18, marginTop: 2 }}
              />
              <span>
                <strong>My own list</strong> — rank at least {autopickRequiredPriorityCount} wrestlers (include at least{" "}
                {AUTOPICK_REQUIRED_FEMALE_COUNT} female).
              </span>
            </label>
          </div>
          {listSource !== "custom" && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                background: "var(--color-bg-surface)",
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                Preview — {DRAFT_BIG_BOARDS[listSource].label}
              </p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-muted)" }}>
                This ranked order is what will be saved to your account when you click Save preferences.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 360, overflowY: "auto" }}>
                {DRAFT_BIG_BOARDS[listSource].wrestlerIds.map((id, index, ids) => {
                  const w = optionForPriorityId(wrestlerLookup, id);
                  const label = w?.name ?? id;
                  const missing = !w;
                  return (
                    <li
                      key={`${id}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 0",
                        borderBottom: index < ids.length - 1 ? "1px solid var(--color-border)" : "none",
                        fontSize: 14,
                      }}
                    >
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, minWidth: 28 }}>#{index + 1}</span>
                      <span style={{ flex: 1, color: missing ? "var(--color-text-muted)" : "var(--color-text)" }}>
                        {label}
                        {missing ? (
                          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 6 }}>
                            (not in draft pool list — ID will still save)
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
      {isAutopickLeague && !hasProvidedBoards && (
        <section>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text)" }}>
            Priority list source
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 0 }}>
            This league uses a custom draft pool, so provided Big Boards are disabled. Use <strong>My own list</strong>{" "}
            for your auto-draft preferences.
          </p>
        </section>
      )}
      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text)" }}>
          Preferred wrestlers {isAutopickLeague ? "(autopick)" : "(optional)"}
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
          {isAutopickLeague ? (
            <>
              When &quot;My own list&quot; is selected, add <strong>{autopickRequiredPriorityCount}+</strong> wrestlers in
              order (at least{" "}
              <strong>{AUTOPICK_REQUIRED_FEMALE_COUNT}</strong> female). When a Big Board is selected, use the preview above, then save.
            </>
          ) : (
            <>
              You can list 10 or more wrestlers in ranked order of preference. Auto-pick will choose the highest-ranked
              available wrestler from this list. Once none from your list are available, the tie-break is the same for
              everyone: {AUTOPICK_LIST_EXHAUSTED_TIE_BREAK} Leave empty to rely on that tie-break only.
            </>
          )}
        </p>
        {!disabled && listSource === "custom" && (
          <div ref={searchContainerRef} style={{ position: "relative", marginBottom: 12, maxWidth: 400 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Type to search wrestlers…"
              className="app-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              aria-label="Search wrestlers to add"
              aria-autocomplete="list"
              aria-expanded={searchOpen && searchResults.length > 0}
              aria-controls="wrestler-search-list"
              id="wrestler-search-input"
            />
            {searchOpen && (
              <ul
                id="wrestler-search-list"
                role="listbox"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "100%",
                  margin: 0,
                  marginTop: 4,
                  padding: 0,
                  listStyle: "none",
                  maxHeight: 280,
                  overflowY: "auto",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 10,
                }}
              >
                {searchResults.length === 0 ? (
                  <li style={{ padding: "12px 14px", fontSize: 14, color: "var(--color-text-muted)" }}>
                    {wrestlerOptions.length === 0
                      ? "No wrestlers available."
                      : availableToAdd.length === 0
                        ? "All wrestlers added."
                        : searchNorm
                          ? "No matches."
                          : "Type to search."}
                  </li>
                ) : (
                  searchResults.map((w, i) => {
                    const details = wrestlerDetailLine(w);
                    return (
                      <li
                        key={w.id}
                        role="option"
                        aria-selected={i === highlightedIndex}
                        style={{
                          padding: "10px 14px",
                          fontSize: 14,
                          cursor: "pointer",
                          background: i === highlightedIndex ? "var(--color-blue-bg, #e8f0fe)" : "transparent",
                        }}
                        onClick={() => addWrestlerById(w.id)}
                        onMouseEnter={() => setHighlightedIndex(i)}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span>{w.name || w.id}</span>
                          {details ? <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{details}</span> : null}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        )}
        {priorityList.length > 0 && (
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-bg-surface)" }}>
            <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--color-text-muted)", margin: 0, borderBottom: "1px solid var(--color-border)" }}>
              Drag to reorder. First in list is highest preference.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 320, overflowY: "auto" }}>
              {priorityList.map((id, index) => {
                const w = optionForPriorityId(wrestlerLookup, id);
                const name = w?.name || id;
                const isDragging = draggedIndex === index;
                return (
                  <li
                    key={`${id}-${index}`}
                    draggable={!disabled}
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom: index < priorityList.length - 1 ? "1px solid var(--color-border)" : "none",
                      fontSize: 14,
                      opacity: isDragging ? 0.5 : 1,
                      cursor: disabled ? "default" : "grab",
                    }}
                  >
                    {!disabled && (
                      <span style={{ color: "var(--color-text-muted)", cursor: "grab", paddingRight: 4 }} aria-hidden="true">⋮⋮</span>
                    )}
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, minWidth: 28 }}>#{index + 1}</span>
                    <span style={{ flex: 1 }}>{name}</span>
                    {!disabled && (
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" onClick={() => moveUp(index)} disabled={index === 0} style={{ padding: "4px 8px", fontSize: 12 }} aria-label="Move up">
                          ↑
                        </button>
                        <button type="button" onClick={() => moveDown(index)} disabled={index === priorityList.length - 1} style={{ padding: "4px 8px", fontSize: 12 }} aria-label="Move down">
                          ↓
                        </button>
                        <button type="button" onClick={() => removeWrestler(index)} style={{ padding: "4px 8px", fontSize: 12, color: "var(--color-red, #c00)" }} aria-label="Remove">
                          Remove
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--color-text-muted)", borderTop: "1px solid var(--color-border)", margin: 0 }}>
              {priorityList.length} wrestler{priorityList.length !== 1 ? "s" : ""}.{" "}
              {priorityList.length > 0 &&
                priorityList.length < minPreferred &&
                "Add at least " + (minPreferred - priorityList.length) + " more to save this list, or remove all."}
              {priorityList.length >= minPreferred && " List is valid."}
            </p>
          </div>
        )}
      </section>

      {message && (
        <p style={{ color: message.type === "error" ? "var(--color-error, #c00)" : "var(--color-success, #0d7d0d)", fontSize: 14 }}>
          {message.text}
        </p>
      )}

      {!disabled && <SubmitButton />}
    </form>
  );
}
