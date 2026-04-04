"use client";

import { useCallback, useMemo, useState } from "react";
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

export function BoxscoreEventCardPanel({
  wrestlers,
  initialTagTeamData,
  eventStatus,
  eventDate,
  matches,
  setMatches,
  /** When set (editing an existing event), MatchEdit can persist live commentary via server actions. */
  eventId,
}: {
  wrestlers: BoxscoreWrestlerRow[];
  initialTagTeamData: BoxscoreTagTeamDataMap;
  eventStatus: string;
  eventDate: string;
  matches: Record<string, unknown>[];
  setMatches: (next: Record<string, unknown>[]) => void;
  eventId?: string;
}) {
  const [modal, setModal] = useState<ModalState>(null);

  const closeModal = useCallback(() => setModal(null), []);

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

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)" }}>Card</span>
        <button
          type="button"
          onClick={() => setModal({ kind: "new-wrestling" })}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          + Wrestling match
        </button>
        <button
          type="button"
          onClick={() => setModal({ kind: "new-promo" })}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          + Promo / segment
        </button>
      </div>

      {matches.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}>
          No matches yet. Add a match or leave the card empty for upcoming events.
        </p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
          {matches.map((m, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--color-text)" }}>{matchSummary(m)}</span>
              <span style={{ color: "var(--color-text-muted)", marginLeft: 8 }}>
                (#{(m.order as number) ?? i + 1})
              </span>
              <button
                type="button"
                className="app-link"
                style={{
                  marginLeft: 12,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  textDecoration: "underline",
                  color: "var(--color-blue)",
                }}
                onClick={() =>
                  m.matchType === "Promo" ? setModal({ kind: "edit-promo", index: i }) : setModal({ kind: "edit-wrestling", index: i })
                }
              >
                Edit
              </button>
              <button
                type="button"
                style={{
                  marginLeft: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  textDecoration: "underline",
                  color: "var(--color-red)",
                }}
                onClick={() => setMatches(matches.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      {modal && (modal.kind === "new-wrestling" || modal.kind === "edit-wrestling") ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.82)",
            zIndex: 1000,
            overflowY: "auto",
            padding: "20px 16px 48px",
          }}
        >
          <div
            style={{
              maxWidth: 920,
              margin: "0 auto",
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
            />
          </div>
        </div>
      ) : null}

      {modal && (modal.kind === "new-promo" || modal.kind === "edit-promo") ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.82)",
            zIndex: 1000,
            overflowY: "auto",
            padding: "20px 16px 48px",
          }}
        >
          <div
            style={{
              maxWidth: 640,
              margin: "0 auto",
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
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
