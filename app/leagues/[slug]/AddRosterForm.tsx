"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { addRosterEntryAction, type AddRosterState } from "./actions";
import type { LeagueMember } from "@/lib/leagues";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";

type WrestlerOption = { id: string; name: string | null; gender?: string | null; brand?: string | null };

type Props = {
  leagueId: string;
  leagueSlug: string;
  members: LeagueMember[];
  wrestlers: WrestlerOption[];
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddRosterForm({ leagueId, leagueSlug, members, wrestlers }: Props) {
  const [state, formAction] = useActionState<AddRosterState | null, FormData>(
    addRosterEntryAction,
    null
  );
  const [memberId, setMemberId] = useState("");
  const [wrestlerInput, setWrestlerInput] = useState("");
  const [wrestlerId, setWrestlerId] = useState("");
  const [acquiredAt, setAcquiredAt] = useState(todayYmd());
  const prevState = useRef<AddRosterState | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [wrestlerOptions, setWrestlerOptions] = useState<WrestlerOption[]>(wrestlers);

  useEffect(() => {
    setWrestlerOptions(wrestlers);
  }, [wrestlers]);

  useEffect(() => {
    if (wrestlerOptions.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wrestlers", { credentials: "same-origin", cache: "no-store" });
        const json = (await res.json()) as { wrestlers?: Array<Record<string, unknown>>; error?: string };
        if (!res.ok || !Array.isArray(json.wrestlers) || cancelled) return;
        const normalized: WrestlerOption[] = json.wrestlers
          .map((w) => {
            const id = String(w.id ?? "");
            const name = String(w.name ?? w.id ?? "");
            const gender = w.gender != null && String(w.gender).trim() !== "" ? String(w.gender) : null;
            const brand = w.brand != null ? String(w.brand) : null;
            return { id, name, gender, brand } as WrestlerOption & { brand?: string | null };
          })
          .filter((w) => {
            if (!w.id) return false;
            const bucket = wrestlerRosterFromBrand((w as { brand?: string | null }).brand ?? null);
            return bucket === "Raw" || bucket === "SmackDown" || bucket === "NXT";
          })
          .sort((a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id), undefined, { sensitivity: "base" }));
        if (!cancelled) setWrestlerOptions(normalized);
      } catch {
        // keep empty list; no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wrestlerOptions.length]);

  const wrestlerChoices = useMemo(() => {
    const nameCount = new Map<string, number>();
    for (const w of wrestlerOptions) {
      const base = (w.name ?? w.id).trim();
      nameCount.set(base, (nameCount.get(base) ?? 0) + 1);
    }
    return wrestlerOptions.map((w) => {
      const base = (w.name ?? w.id).trim();
      const label = (nameCount.get(base) ?? 0) > 1 ? `${base} (${w.id})` : base;
      return { id: w.id, label };
    });
  }, [wrestlerOptions]);

  const wrestlerIdByLabel = useMemo(() => {
    const out = new Map<string, string>();
    for (const c of wrestlerChoices) out.set(c.label.toLowerCase(), c.id);
    return out;
  }, [wrestlerChoices]);

  const handleWrestlerInput = (value: string) => {
    setWrestlerInput(value);
    setWrestlerId(wrestlerIdByLabel.get(value.trim().toLowerCase()) ?? "");
  };

  const filteredChoices = useMemo(() => {
    const q = wrestlerInput.trim().toLowerCase();
    if (!q) return wrestlerChoices.slice(0, 25);
    return wrestlerChoices
      .filter((w) => w.label.toLowerCase().includes(q))
      .slice(0, 25);
  }, [wrestlerChoices, wrestlerInput]);

  useEffect(() => {
    // Successful submit: keep selected member/date, clear wrestler for fast consecutive entry.
    if (state && !state.error && prevState.current !== state) {
      setWrestlerInput("");
      setWrestlerId("");
      setShowSuggestions(false);
    }
    prevState.current = state;
  }, [state]);

  return (
    <div
      style={{
        marginBottom: 24,
        padding: 16,
        background: "var(--color-bg-surface)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h3 style={{ fontSize: "1rem", marginBottom: 12, color: "var(--color-text)" }}>Add wrestler to roster</h3>
      {state?.error && (
        <p
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--color-red-bg)",
            border: "1px solid var(--color-red-muted)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-red)",
            fontSize: 14,
          }}
        >
          {state.error}
        </p>
      )}
      <form action={formAction} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <input type="hidden" name="leagueSlug" value={leagueSlug} />
        <input type="hidden" name="leagueId" value={leagueId} />
        <div>
          <label htmlFor="roster-member" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--color-text-muted)" }}>
            Member
          </label>
          <select
            id="roster-member"
            name="userId"
            required
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            style={{ padding: "8px 12px", minWidth: 160, background: "var(--color-bg-input)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
          >
            <option value="">Select member</option>
            {members.map((m) => (
              <option key={m.id} value={m.user_id}>
                {m.display_name?.trim() || "Unknown"}
                {m.role === "commissioner" ? " (GM)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="roster-wrestler" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Wrestler
          </label>
          <div style={{ position: "relative", minWidth: 280 }}>
            <input
              id="roster-wrestler"
              required
              value={wrestlerInput}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              onChange={(e) => {
                handleWrestlerInput(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Start typing wrestler name"
              style={{ padding: "8px 12px", minWidth: 280, width: "100%" }}
            />
            {showSuggestions && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  maxHeight: 220,
                  overflowY: "auto",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  zIndex: 20,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                }}
              >
                {filteredChoices.length === 0 ? (
                  <div
                    style={{
                      padding: "8px 10px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    No matching wrestlers
                  </div>
                ) : (
                  filteredChoices.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setWrestlerInput(w.label);
                        setWrestlerId(w.id);
                        setShowSuggestions(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        border: "none",
                        borderBottom: "1px solid var(--color-border)",
                        background: "transparent",
                        color: "var(--color-text)",
                        cursor: "pointer",
                      }}
                    >
                      {w.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <input type="hidden" name="wrestlerId" value={wrestlerId} />
        </div>
        <div>
          <label htmlFor="roster-acquired" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--color-text-muted)" }}>
            Acquisition date (optional)
          </label>
          <input
            id="roster-acquired"
            type="date"
            name="acquiredAt"
            value={acquiredAt}
            onChange={(e) => setAcquiredAt(e.target.value)}
            style={{ padding: "8px 12px", background: "var(--color-bg-input)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
          />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: 6 }}>Points count from this date onward. Default: today.</span>
        </div>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            background: "var(--color-blue)",
            color: "var(--color-text)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Add
        </button>
      </form>
    </div>
  );
}
