"use client";

import { useState, useTransition } from "react";
import { dropWrestlerAction, addFreeAgentAction } from "./actions";
import type { RosterRules } from "@/lib/leagueStructure";

type Wrestler = { id: string; name: string | null; gender?: string | null };

function normalizeGender(g: string | null | undefined): "F" | "M" | null {
  if (g == null || typeof g !== "string") return null;
  const lower = g.trim().toLowerCase();
  if (lower === "female" || lower === "f") return "F";
  if (lower === "male" || lower === "m") return "M";
  return null;
}

function wouldBeCompliantAfterDrop(
  roster: Wrestler[],
  dropId: string,
  rules: RosterRules
): boolean {
  const minTotal = rules.minFemale + rules.minMale;
  let total = 0;
  let female = 0;
  let male = 0;
  for (const w of roster) {
    if (w.id === dropId) continue;
    total++;
    const g = normalizeGender(w.gender);
    if (g === "F") female++;
    else if (g === "M") male++;
  }
  return total >= minTotal && female >= rules.minFemale && male >= rules.minMale;
}

export function ProposeReleaseForm(props: {
  leagueSlug: string;
  rosterWrestlers: Wrestler[];
  rosterRules: RosterRules | null;
  freeAgents: { id: string; name: string | null }[];
  pendingReleaseIds: string[];
  initialWrestlerId?: string | null;
  /** Wrestlers reserved for an unfinished trade — cannot drop until trade completes or is cancelled */
  tradeLockedWrestlerIds?: string[];
}) {
  const { leagueSlug, rosterWrestlers, rosterRules, freeAgents, initialWrestlerId, tradeLockedWrestlerIds = [] } = props;
  const tradeLocked = new Set(tradeLockedWrestlerIds.map((id) => String(id).trim()).filter(Boolean));
  const [wrestlerId, setWrestlerId] = useState(initialWrestlerId ?? "");
  const [freeAgentId, setFreeAgentId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const minTotal = rosterRules ? rosterRules.minFemale + rosterRules.minMale : 8;
  const selectedLocked = !!(wrestlerId.trim() && tradeLocked.has(wrestlerId.trim()));
  const canDropOnly = wrestlerId.trim() && !selectedLocked && (
    !rosterRules || wouldBeCompliantAfterDrop(rosterWrestlers, wrestlerId.trim(), rosterRules)
  );
  const mustAddFa =
    wrestlerId.trim() &&
    rosterRules &&
    !wouldBeCompliantAfterDrop(rosterWrestlers, wrestlerId.trim(), rosterRules);

  const handleDropOnly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wrestlerId.trim() || !canDropOnly || tradeLocked.has(wrestlerId.trim())) return;
    setMessage(null);
    startTransition(async () => {
      const result = await dropWrestlerAction(leagueSlug, wrestlerId.trim());
      if (result.error) setMessage({ type: "err", text: result.error });
      else {
        setMessage({ type: "ok", text: "Wrestler dropped." });
        setWrestlerId("");
      }
    });
  };

  const handleDropAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wrestlerId.trim() || !freeAgentId.trim()) return;
    if (mustAddFa && !freeAgentId.trim()) return;
    if (tradeLocked.has(wrestlerId.trim())) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addFreeAgentAction(
        leagueSlug,
        freeAgentId.trim(),
        wrestlerId.trim()
      );
      if (result.error) setMessage({ type: "err", text: result.error });
      else {
        setMessage({ type: "ok", text: "Wrestler dropped and free agent added." });
        setWrestlerId("");
        setFreeAgentId("");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label htmlFor="release-wrestler" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
          Wrestler to drop
        </label>
        <select
          id="release-wrestler"
          value={wrestlerId}
          onChange={(e) => {
            setWrestlerId(e.target.value);
            setFreeAgentId("");
          }}
          style={{ padding: "8px 12px", minWidth: 200 }}
        >
          <option value="">Select…</option>
          {rosterWrestlers.map((w) => (
            <option key={w.id} value={w.id} disabled={tradeLocked.has(w.id)}>
              {tradeLocked.has(w.id) ? `${w.name ?? w.id} (pending trade)` : (w.name ?? w.id)}
            </option>
          ))}
        </select>
      </div>

      {wrestlerId.trim() && selectedLocked && (
        <p style={{ margin: 0, fontSize: 14, color: "#b45309" }}>
          This wrestler is tied to a pending trade or was chosen as your roster cut for a trade awaiting the
          GM. You can’t drop them until that trade is cancelled or processed.
        </p>
      )}

      {wrestlerId.trim() && (
        <>
          {mustAddFa && rosterRules ? (
            <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 4 }}>
              After dropping this wrestler your roster would be below the minimum (
              {minTotal} wrestlers, {rosterRules.minFemale} women, {rosterRules.minMale} men). You
              must add a free agent to stay in compliance.
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 4 }}>
              {rosterRules
                ? "You can drop only, or drop and add a free agent at the same time."
                : "Drop only, or drop and add a free agent at the same time."}
            </div>
          )}

          {canDropOnly && (
            <button
              type="button"
              onClick={handleDropOnly}
              disabled={pending}
              style={{
                padding: "8px 16px",
                background: "#333",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                cursor: pending ? "not-allowed" : "pointer",
                alignSelf: "flex-start",
              }}
            >
              {pending ? "Dropping…" : "Drop only"}
            </button>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label
                htmlFor="release-fa"
                style={{ display: "block", fontSize: 12, marginBottom: 4 }}
              >
                {mustAddFa ? "Free agent to add (required)" : "Or replace with a free agent"}
              </label>
              <select
                id="release-fa"
                value={freeAgentId}
                onChange={(e) => setFreeAgentId(e.target.value)}
                style={{ padding: "8px 12px", minWidth: 200 }}
              >
                <option value="">Select…</option>
                {freeAgents.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name ?? w.id}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleDropAndAdd}
              disabled={pending || !freeAgentId.trim() || selectedLocked}
              style={{
                padding: "8px 16px",
                background: "#1a73e8",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                cursor: pending || !freeAgentId.trim() ? "not-allowed" : "pointer",
              }}
            >
              {pending ? "Submitting…" : "Drop and add free agent"}
            </button>
          </div>
        </>
      )}

      {message && (
        <p style={{ margin: 0, fontSize: 14, color: message.type === "err" ? "#b91c1c" : "#166534" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
