"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { saveDraftPreferencesFormAction } from "../actions";

const MIN_PRIORITY = 10;
const MAX_PRIORITY = 50;

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

const FOCUS_OPTIONS = [
  { value: "all", label: "All-time points" },
  { value: "2026", label: "2026 points" },
  { value: "2025", label: "2025 points" },
];

const POINT_STRATEGY_OPTIONS = [
  { value: "total", label: "Total Points" },
  { value: "rs", label: "R/S points" },
  { value: "ple", label: "PLE Points" },
  { value: "belt", label: "Belt Points" },
];

const WRESTLER_STRATEGY_OPTIONS = [
  { value: "best_available", label: "Best available" },
  { value: "balanced_gender", label: "Balanced male/female" },
  { value: "balanced_brands", label: "Balanced Raw/SmackDown" },
  { value: "high_males", label: "High ranking males" },
  { value: "high_females", label: "High ranking females" },
];

type WrestlerOption = { id: string; name: string | null };

type Props = {
  leagueSlug: string;
  wrestlerOptions: WrestlerOption[];
  initialPriorityList: string[];
  initialFocus: string;
  initialPointStrategy: string;
  initialWrestlerStrategy: string;
  disabled?: boolean;
};

export function DraftPreferencesForm({
  leagueSlug,
  wrestlerOptions,
  initialPriorityList,
  initialFocus,
  initialPointStrategy,
  initialWrestlerStrategy,
  disabled = false,
}: Props) {
  const [priorityList, setPriorityList] = useState<string[]>(initialPriorityList);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(initialFocus);
  const [pointStrategy, setPointStrategy] = useState(initialPointStrategy);
  const [wrestlerStrategy, setWrestlerStrategy] = useState(initialWrestlerStrategy);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const router = useRouter();
  const priorityListInputRef = useRef<HTMLInputElement>(null);
  const [formState, formAction] = useFormState(saveDraftPreferencesFormAction, null as { error?: string } | null);

  useEffect(() => {
    if (priorityListInputRef.current) {
      priorityListInputRef.current.value = JSON.stringify(priorityList);
    }
  }, [priorityList]);

  useEffect(() => {
    if (formState != null && !formState.error) {
      setMessage({ type: "success", text: "Preferences saved." });
      router.refresh();
    } else if (formState?.error) {
      setMessage({ type: "error", text: formState.error });
    }
  }, [formState, router]);

  const optionById = useMemo(() => new Map(wrestlerOptions.map((w) => [w.id, w])), [wrestlerOptions]);
  const availableToAdd = useMemo(
    () => wrestlerOptions.filter((w) => !priorityList.includes(w.id)),
    [wrestlerOptions, priorityList]
  );
  const searchNorm = normalizeSearch(searchQuery);
  const searchResults = useMemo(() => {
    if (!searchNorm) return availableToAdd.slice(0, 50);
    const q = searchNorm;
    return availableToAdd.filter((w) => {
      const name = (w.name || "").toLowerCase();
      const id = (w.id || "").toLowerCase();
      return name.includes(q) || id.includes(q) || name.replace(/-/g, " ").includes(q);
    }).slice(0, 50);
  }, [availableToAdd, searchNorm]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= searchResults.length) setHighlightedIndex(Math.max(0, searchResults.length - 1));
  }, [searchResults.length, highlightedIndex]);

  const addWrestlerById = (id: string) => {
    if (!id || priorityList.includes(id) || priorityList.length >= MAX_PRIORITY) return;
    setPriorityList((prev) => [...prev, id]);
    setSearchQuery("");
    setSearchOpen(false);
    setHighlightedIndex(0);
  };

  const removeWrestler = (index: number) => {
    setPriorityList((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setPriorityList((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= priorityList.length - 1) return;
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
    if (priorityList.length > 0 && (priorityList.length < MIN_PRIORITY || priorityList.length > MAX_PRIORITY)) {
      e.preventDefault();
      setMessage({ type: "error", text: `Preferred wrestlers list must have between ${MIN_PRIORITY} and ${MAX_PRIORITY} wrestlers when set.` });
      return;
    }
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <input type="hidden" name="league_slug" value={leagueSlug} />
      <input ref={priorityListInputRef} type="hidden" name="priority_list" defaultValue={JSON.stringify(priorityList)} />
      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text)" }}>
          Preferred wrestlers (optional)
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
          You can list 10–50 wrestlers in ranked order of preference. Auto-pick will choose the highest-ranked available wrestler from this list. Once none from your list are available, your focus and strategies below take over. Leave empty to use only the strategies below.
        </p>
        {!disabled && (
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
                  searchResults.map((w, i) => (
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
                      {w.name || w.id}
                    </li>
                  ))
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
                const w = optionById.get(id);
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
              {priorityList.length} wrestler{priorityList.length !== 1 ? "s" : ""}. {priorityList.length > 0 && priorityList.length < MIN_PRIORITY && "Add at least " + (MIN_PRIORITY - priorityList.length) + " more to save this list, or remove all."}
              {priorityList.length >= MIN_PRIORITY && priorityList.length <= MAX_PRIORITY && " List is valid."}
              {priorityList.length > MAX_PRIORITY && " Maximum is " + MAX_PRIORITY + "."}
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, color: "var(--color-text)" }}>
          Choose a focus
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FOCUS_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="focus"
                checked={focus === opt.value}
                onChange={() => setFocus(opt.value)}
                disabled={disabled}
                style={{ width: 18, height: 18 }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, color: "var(--color-text)" }}>
          Choose a point strategy
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {POINT_STRATEGY_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="pointStrategy"
                checked={pointStrategy === opt.value}
                onChange={() => setPointStrategy(opt.value)}
                disabled={disabled}
                style={{ width: 18, height: 18 }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text)" }}>
          Choose a wrestler strategy
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>
          Best available: top by points. Balanced male/female: balance roster by gender. Balanced Raw/SmackDown: by brand. High ranking males/females: rank by total points × 1.2, draft best.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {WRESTLER_STRATEGY_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="wrestlerStrategy"
                checked={wrestlerStrategy === opt.value}
                onChange={() => setWrestlerStrategy(opt.value)}
                disabled={disabled}
                style={{ width: 18, height: 18 }}
              />
              {opt.label}
            </label>
          ))}
        </div>
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
