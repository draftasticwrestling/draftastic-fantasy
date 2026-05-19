"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BoxscoreTagTeamDataMap, BoxscoreWrestlerRow } from "@/lib/boxscoreAdmin/boxscoreEditorData";
import MatchEdit, { PromoMatchEdit } from "../../match-edit/MatchEdit";

const EMPTY_WRESTLING_MATCH = {
  participants: "",
  result: "",
  method: "",
  time: "",
  matchType: "Singles Match",
  stipulation: "None",
  customStipulation: "",
  title: "",
  titleOutcome: "",
  defendingChampion: "",
  notes: "",
  cardType: "Undercard",
  isLive: false,
};

function matchSummary(m: Record<string, unknown>): string {
  if (m.matchType === "Promo") {
    return `Promo: ${(m.title as string) || "(untitled)"}`;
  }
  const p = m.participants;
  if (typeof p === "string") return p || "(no participants)";
  if (Array.isArray(p)) return p.filter(Boolean).join(", ") || "(no participants)";
  return String(p ?? "(match)");
}

type ModalState =
  | null
  | { kind: "new-wrestling" }
  | { kind: "new-promo" }
  | { kind: "edit-wrestling"; index: number }
  | { kind: "edit-promo"; index: number };

function renumberMatchOrders(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items.map((m, i) => ({ ...m, order: i + 1 }));
}

function swapEditModalIndex(modal: ModalState, from: number, to: number): ModalState {
  if (!modal) return modal;
  if (modal.kind === "edit-wrestling" || modal.kind === "edit-promo") {
    if (modal.index === from) return { ...modal, index: to };
    if (modal.index === to) return { ...modal, index: from };
  }
  return modal;
}

export function BoxscoreEventCardPanel({
  wrestlers,
  initialTagTeamData,
  eventStatus,
  eventDate,
  matches,
  setMatches,
  /** When set (editing an existing event), MatchEdit can persist live commentary via server actions. */
  eventId,
  stipulationOptions,
  specialWinnerOptions,
}: {
  wrestlers: BoxscoreWrestlerRow[];
  initialTagTeamData: BoxscoreTagTeamDataMap;
  eventStatus: string;
  eventDate: string;
  matches: Record<string, unknown>[];
  setMatches: (next: Record<string, unknown>[]) => void;
  eventId?: string;
  stipulationOptions?: string[];
  specialWinnerOptions?: string[];
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const inlineEditorRef = useRef<HTMLDivElement | null>(null);

  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    if (!modal) return;
    const el = inlineEditorRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [modal]);

  const handleSaveWrestling = useCallback(
    (updated: Record<string, unknown>) => {
      if (!modal || modal.kind === "new-promo" || modal.kind === "edit-promo") return;
      const nextOrder =
        modal.kind === "edit-wrestling"
          ? Number((matches[modal.index] as { order?: number })?.order) || modal.index + 1
          : matches.length + 1;
      const withOrder = { ...updated, order: nextOrder };
      if (modal.kind === "edit-wrestling") {
        const copy = [...matches];
        copy[modal.index] = withOrder;
        setMatches(copy);
      } else {
        setMatches([...matches, withOrder]);
      }
      closeModal();
    },
    [modal, matches, setMatches, closeModal]
  );

  const handleSavePromo = useCallback(
    (updated: Record<string, unknown>) => {
      if (!modal || modal.kind === "new-wrestling" || modal.kind === "edit-wrestling") return;
      const nextOrder =
        modal.kind === "edit-promo"
          ? Number((matches[modal.index] as { order?: number })?.order) || modal.index + 1
          : matches.length + 1;
      const withOrder = { ...updated, order: nextOrder };
      if (modal.kind === "edit-promo") {
        const copy = [...matches];
        copy[modal.index] = withOrder;
        setMatches(copy);
      } else {
        setMatches([...matches, withOrder]);
      }
      closeModal();
    },
    [modal, matches, setMatches, closeModal]
  );

  const wrestlingInitial = useMemo(() => {
    if (!modal || modal.kind === "new-wrestling") {
      return { ...EMPTY_WRESTLING_MATCH, status: eventStatus || "completed" };
    }
    if (modal.kind === "edit-wrestling") {
      return { ...EMPTY_WRESTLING_MATCH, ...matches[modal.index], status: eventStatus || "completed" };
    }
    return { ...EMPTY_WRESTLING_MATCH, status: eventStatus || "completed" };
  }, [modal, matches, eventStatus]);

  const promoInitial = useMemo(() => {
    if (!modal || modal.kind === "new-promo") return {};
    if (modal.kind === "edit-promo") return matches[modal.index] || {};
    return {};
  }, [modal, matches]);

  const modalKey =
    modal?.kind === "edit-wrestling" || modal?.kind === "edit-promo"
      ? `edit-${modal.index}`
      : modal?.kind === "new-wrestling"
        ? "new-w"
        : modal?.kind === "new-promo"
          ? "new-p"
          : "closed";

  const matchOrderForModal =
    modal?.kind === "edit-wrestling"
      ? Number((matches[modal.index] as { order?: number })?.order) || modal.index + 1
      : modal?.kind === "new-wrestling"
        ? matches.length + 1
        : undefined;

  const pillActive = {
    padding: "8px 18px",
    borderRadius: 999,
    border: "1px solid var(--color-accent, #b8860b)",
    background: "var(--color-accent, #b8860b)",
    color: "#111",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  } as const;
  const pillIdle = {
    padding: "8px 18px",
    borderRadius: 999,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg-surface)",
    color: "var(--color-text)",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  } as const;
  const isMatchModal = modal?.kind === "new-wrestling" || modal?.kind === "edit-wrestling";
  const isPromoModal = modal?.kind === "new-promo" || modal?.kind === "edit-promo";

  const moveMatch = useCallback(
    (from: number, direction: "up" | "down") => {
      const to = direction === "up" ? from - 1 : from + 1;
      if (to < 0 || to >= matches.length) return;
      const copy = [...matches];
      [copy[from], copy[to]] = [copy[to], copy[from]];
      setMatches(renumberMatchOrders(copy));
      setModal((prev) => swapEditModalIndex(prev, from, to));
    },
    [matches, setMatches]
  );

  const removeMatch = useCallback(
    (index: number) => {
      const next = renumberMatchOrders(matches.filter((_, j) => j !== index));
      setMatches(next);
      setModal((prev) => {
        if (!prev) return prev;
        if (prev.kind === "edit-wrestling" || prev.kind === "edit-promo") {
          if (prev.index === index) return null;
          if (prev.index > index) return { ...prev, index: prev.index - 1 };
        }
        return prev;
      });
    },
    [matches, setMatches]
  );

  const reorderBtn = (disabled: boolean): CSSProperties => ({
    width: 32,
    height: 32,
    padding: 0,
    border: "none",
    borderRadius: 4,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1,
    background: disabled ? "var(--color-border)" : "var(--color-accent, #c6a04f)",
    color: disabled ? "var(--color-text-muted)" : "#111",
    opacity: disabled ? 0.55 : 1,
  });

  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Add matches</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.45, maxWidth: 640 }}>
        Choose <strong>Match</strong> to open the visual match builder (singles, tags, title matches, gauntlets, and more).
        Use <strong>Promo</strong> for segments. Completed and live events require valid match results before saving.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <button type="button" onClick={() => setModal({ kind: "new-wrestling" })} style={isMatchModal ? pillActive : pillIdle}>
          Match
        </button>
        <button type="button" onClick={() => setModal({ kind: "new-promo" })} style={isPromoModal ? pillActive : pillIdle}>
          Promo
        </button>
      </div>

      {matches.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}>
          No matches yet. Add a match or leave the card empty for upcoming events.
        </p>
      ) : (
        <ol style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 14, lineHeight: 1.6 }}>
          {matches.map((m, i) => {
            const isPromo = m.matchType === "Promo";
            return (
              <li
                key={`${i}-${String(m.order ?? i + 1)}`}
                style={{
                  marginBottom: 10,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-surface)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 700, minWidth: 24, color: "var(--color-text-muted)" }}>{i + 1}.</span>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        padding: "2px 6px",
                        borderRadius: 4,
                        marginRight: 8,
                        background: isPromo ? "#555" : "var(--color-accent, #c6a04f)",
                        color: isPromo ? "#fff" : "#111",
                      }}
                    >
                      {isPromo ? "PROMO" : "MATCH"}
                    </span>
                    <span style={{ color: "var(--color-text)" }}>{matchSummary(m)}</span>
                    <span style={{ color: "var(--color-text-muted)", marginLeft: 8 }}>
                      (#{(m.order as number) ?? i + 1})
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      title="Move up"
                      aria-label={`Move match ${i + 1} up`}
                      disabled={i === 0}
                      style={reorderBtn(i === 0)}
                      onClick={() => moveMatch(i, "up")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      aria-label={`Move match ${i + 1} down`}
                      disabled={i === matches.length - 1}
                      style={reorderBtn(i === matches.length - 1)}
                      onClick={() => moveMatch(i, "down")}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="app-link"
                      style={{
                        marginLeft: 4,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        textDecoration: "underline",
                        color: "var(--color-blue)",
                      }}
                      onClick={() =>
                        isPromo ? setModal({ kind: "edit-promo", index: i }) : setModal({ kind: "edit-wrestling", index: i })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        textDecoration: "underline",
                        color: "var(--color-red)",
                      }}
                      onClick={() => removeMatch(i)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {modal && (modal.kind === "new-wrestling" || modal.kind === "edit-wrestling") ? (
        <div
          ref={inlineEditorRef}
          role="region"
          aria-label="Wrestling match editor"
          style={{ marginTop: matches.length > 0 ? 24 : 16 }}
        >
          <div
            style={{
              maxWidth: 920,
              background: "#1a1a1a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: 20,
              color: "#fff",
            }}
          >
            <MatchEdit
              key={modalKey}
              initialMatch={wrestlingInitial}
              onSave={handleSaveWrestling}
              onCancel={closeModal}
              eventStatus={eventStatus}
              eventDate={eventDate}
              eventId={eventId}
              matchOrder={matchOrderForModal}
              wrestlers={wrestlers}
              initialTagTeamData={initialTagTeamData}
              stipulationOptions={stipulationOptions}
              specialWinnerOptions={specialWinnerOptions}
              variant={modal.kind === "new-wrestling" ? "add" : "edit"}
            />
          </div>
        </div>
      ) : null}

      {modal && (modal.kind === "new-promo" || modal.kind === "edit-promo") ? (
        <div
          ref={inlineEditorRef}
          role="region"
          aria-label="Promo segment editor"
          style={{ marginTop: matches.length > 0 ? 24 : 16 }}
        >
          <div
            style={{
              maxWidth: 640,
              background: "#1a1a1a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: 20,
              color: "#fff",
            }}
          >
            <PromoMatchEdit
              key={modalKey}
              initialMatch={promoInitial}
              onSave={handleSavePromo}
              onCancel={closeModal}
              wrestlers={wrestlers}
              variant={modal.kind === "new-promo" ? "add" : "edit"}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
