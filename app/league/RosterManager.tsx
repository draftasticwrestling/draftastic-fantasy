"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LEAGUE_MEMBERS } from "@/lib/league";

const CONTRACT_OPTIONS = [
  { value: "3 yr", label: "3 year" },
  { value: "2 yr", label: "2 year" },
  { value: "1 yr", label: "1 year" },
  { value: "", label: "Other" },
] as const;

type Assignment = { wrestler_id: string; contract: string | null };
type AssignmentsByOwner = Record<string, Assignment[]>;

type WrestlerOption = { id: string; name: string | null };

function matchQuery(w: WrestlerOption, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  const name = (w.name ?? w.id).toLowerCase();
  const id = w.id.toLowerCase();
  return name.includes(lower) || id.includes(lower);
}

export default function RosterManager() {
  const [owners] = useState(() => LEAGUE_MEMBERS);
  const [selectedOwner, setSelectedOwner] = useState<string>(owners[0]?.slug ?? "");
  const [assignments, setAssignments] = useState<AssignmentsByOwner>({});
  const [wrestlers, setWrestlers] = useState<WrestlerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [newWrestlerId, setNewWrestlerId] = useState("");
  const [newContract, setNewContract] = useState<string>("2 yr");
  const [wrestlerSearch, setWrestlerSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rosterRes, wrestlersRes] = await Promise.all([
        fetch("/api/league/roster"),
        fetch("/api/wrestlers"),
      ]);
      const rosterData = await rosterRes.json();
      const wrestlersData = await wrestlersRes.json();
      if (rosterData.assignments) setAssignments(rosterData.assignments);
      const list = Array.isArray(wrestlersData) ? wrestlersData : wrestlersData?.wrestlers ?? [];
      setWrestlers(
        list.map((w: { id: string; name?: string | null }) => ({
          id: w.id,
          name: w.name ?? w.id,
        }))
      );
    } catch (e) {
      setMessage({ type: "err", text: "Failed to load roster" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentRoster = assignments[selectedOwner] ?? [];
  const assignedIds = new Set(currentRoster.map((a) => a.wrestler_id.toLowerCase()));
  const availableWrestlers = wrestlers.filter(
    (w) => !assignedIds.has(w.id.toLowerCase())
  );
  const filteredWrestlers = availableWrestlers.filter((w) => matchQuery(w, wrestlerSearch));
  const displaySearch = newWrestlerId
    ? (wrestlers.find((w) => w.id === newWrestlerId)?.name ?? newWrestlerId)
    : wrestlerSearch;
  const safeHighlightedIndex = Math.min(highlightedIndex, Math.max(0, filteredWrestlers.length - 1));

  const showMessage = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), type === "err" ? 8000 : 3000);
  };

  const addAssignment = async () => {
    if (!newWrestlerId.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/league/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          owner_slug: selectedOwner,
          wrestler_id: newWrestlerId.trim(),
          contract: newContract || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" — ") || "Failed to save";
        throw new Error(msg);
      }
      await load();
      setNewWrestlerId("");
      setWrestlerSearch("");
      setDropdownOpen(false);
      showMessage("ok", "Added to roster");
    } catch (e) {
      showMessage("err", e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const updateContract = async (wrestlerId: string, contract: string | null) => {
    setSaving(true);
    try {
      const res = await fetch("/api/league/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          owner_slug: selectedOwner,
          wrestler_id: wrestlerId,
          contract,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" — ") || "Failed to save";
        throw new Error(msg);
      }
      await load();
      showMessage("ok", "Contract updated");
    } catch (e) {
      showMessage("err", e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (wrestlerId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/league/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          owner_slug: selectedOwner,
          wrestler_id: wrestlerId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" — ") || "Failed to remove";
        throw new Error(msg);
      }
      await load();
      showMessage("ok", "Removed from roster");
    } catch (e) {
      showMessage("err", e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  };

  const selectedOwnerName = owners.find((o) => o.slug === selectedOwner)?.name ?? selectedOwner;

  if (loading) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Assign wrestlers to owners</h2>
        <p style={{ color: "#666" }}>Loading…</p>
      </section>
    );
  }

  return (
    <section
      style={{
        marginTop: 32,
        padding: 24,
        background: "#fafafa",
        border: "1px solid #e8e8e8",
        borderRadius: 12,
      }}
    >
      <h2 style={{ fontSize: "1.25rem", marginBottom: 8 }}>Assign wrestlers to owners</h2>
      <p style={{ color: "#555", marginBottom: 20, fontSize: 15 }}>
        Assign wrestlers to each owner and set contract length. These appear on each team page.
      </p>

      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: message.type === "ok" ? "#e8f5e9" : "#ffebee",
            color: message.type === "ok" ? "#2e7d32" : "#c62828",
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          Owner
        </label>
        <select
          value={selectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
          style={{
            padding: "10px 14px",
            fontSize: 15,
            borderRadius: 8,
            border: "1px solid #ccc",
            minWidth: 220,
          }}
        >
          {owners.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          Add wrestler to {selectedOwnerName}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
          <div style={{ position: "relative", minWidth: 240 }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type to search wrestlers…"
              value={displaySearch}
              onChange={(e) => {
                setWrestlerSearch(e.target.value);
                setNewWrestlerId("");
                setDropdownOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              onKeyDown={(e) => {
                if (!dropdownOpen || filteredWrestlers.length === 0) {
                  if (e.key === "Enter" && newWrestlerId) addAssignment();
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIndex((i) => (i + 1) % filteredWrestlers.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIndex((i) => (i - 1 + filteredWrestlers.length) % filteredWrestlers.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const w = filteredWrestlers[safeHighlightedIndex];
                  if (w) {
                    setNewWrestlerId(w.id);
                    setWrestlerSearch("");
                    setDropdownOpen(false);
                  }
                } else if (e.key === "Escape") {
                  setDropdownOpen(false);
                }
              }}
              style={{
                padding: "10px 14px",
                fontSize: 15,
                borderRadius: 8,
                border: "1px solid #ccc",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            {dropdownOpen && filteredWrestlers.length > 0 && (
              <div
                ref={dropdownRef}
                role="listbox"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 2,
                  maxHeight: 220,
                  overflowY: "auto",
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 10,
                }}
              >
                {filteredWrestlers.slice(0, 50).map((w, i) => (
                  <div
                    key={w.id}
                    role="option"
                    aria-selected={i === safeHighlightedIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setNewWrestlerId(w.id);
                      setWrestlerSearch("");
                      setDropdownOpen(false);
                      searchInputRef.current?.blur();
                    }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    style={{
                      padding: "10px 14px",
                      fontSize: 15,
                      cursor: "pointer",
                      background: i === safeHighlightedIndex ? "#e3f2fd" : "transparent",
                    }}
                  >
                    {w.name ?? w.id}
                  </div>
                ))}
                {filteredWrestlers.length > 50 && (
                  <div style={{ padding: "8px 14px", fontSize: 13, color: "#666" }}>
                    Type more to narrow ({filteredWrestlers.length} matches)
                  </div>
                )}
              </div>
            )}
          </div>
          <select
            value={newContract}
            onChange={(e) => setNewContract(e.target.value)}
            style={{
              padding: "10px 14px",
              fontSize: 15,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          >
            {CONTRACT_OPTIONS.map((o) => (
              <option key={o.value || "other"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addAssignment}
            disabled={saving || !newWrestlerId.trim()}
            style={{
              padding: "10px 18px",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 8,
              border: "none",
              background: "#1a73e8",
              color: "#fff",
              cursor: saving || !newWrestlerId.trim() ? "not-allowed" : "pointer",
              opacity: saving || !newWrestlerId.trim() ? 0.7 : 1,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: "1rem", marginBottom: 12, color: "#333" }}>
          {selectedOwnerName}’s roster ({currentRoster.length})
        </h3>
        {currentRoster.length === 0 ? (
          <p style={{ color: "#666", fontSize: 15 }}>No wrestlers assigned yet. Add one above.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {currentRoster.map((a) => {
              const wrestler = wrestlers.find((w) => w.id.toLowerCase() === a.wrestler_id.toLowerCase());
              const displayName = wrestler?.name ?? a.wrestler_id;
              return (
                <li
                  key={a.wrestler_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 500 }}>{displayName}</span>
                  <select
                    value={a.contract ?? ""}
                    onChange={(e) => updateContract(a.wrestler_id, e.target.value || null)}
                    disabled={saving}
                    style={{
                      padding: "6px 10px",
                      fontSize: 14,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                    }}
                  >
                    {CONTRACT_OPTIONS.map((o) => (
                      <option key={o.value || "other"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeAssignment(a.wrestler_id)}
                    disabled={saving}
                    style={{
                      padding: "6px 12px",
                      fontSize: 13,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      background: "#fff",
                      color: "#c62828",
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
