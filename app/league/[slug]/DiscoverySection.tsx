"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getPickLabel } from "@/lib/draftPicks";
import type { DraftPickRow } from "@/lib/draftPicks";
import type { DiscoveryHoldingWithStatus } from "@/lib/discoveryHoldings";

type Props = {
  ownerSlug: string;
  ownerName: string;
  holdings: DiscoveryHoldingWithStatus[];
  unusedDiscoveryPicks: DraftPickRow[];
};

function statusLabel(h: DiscoveryHoldingWithStatus): string {
  switch (h.status) {
    case "rights_held":
      return "Rights held (no WWE MR debut yet)";
    case "clock_started":
      return h.monthsLeft != null ? `${h.monthsLeft} months left to activate` : "Clock started";
    case "expired":
      return "Expired (12 months passed)";
    case "activated":
      return "Activated (on roster)";
    default:
      return "";
  }
}

export default function DiscoverySection({ ownerSlug, ownerName, holdings, unusedDiscoveryPicks }: Props) {
  const router = useRouter();
  const [wrestlerName, setWrestlerName] = useState("");
  const [company, setCompany] = useState("");
  const [draftPickId, setDraftPickId] = useState(unusedDiscoveryPicks[0]?.id ?? "");
  const [debutDate, setDebutDate] = useState("");
  const [holdingForDebut, setHoldingForDebut] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const createHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!wrestlerName.trim()) {
      setMessage({ type: "err", text: "Enter a wrestler name." });
      return;
    }
    if (!draftPickId) {
      setMessage({ type: "err", text: "Select an unused discovery pick." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/league/discovery-holdings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_slug: ownerSlug,
          draft_pick_id: draftPickId,
          wrestler_name: wrestlerName.trim(),
          company: company.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Failed to add." });
        return;
      }
      setMessage({ type: "ok", text: "Discovery rights added." });
      setWrestlerName("");
      setCompany("");
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  const setDebut = async (holdingId: string) => {
    if (!debutDate.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/league/discovery-holdings/set-debut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holding_id: holdingId, debut_date: debutDate.slice(0, 10) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Failed to set debut date." });
        return;
      }
      setMessage({ type: "ok", text: "Debut date set. 12-month clock started." });
      setHoldingForDebut(null);
      setDebutDate("");
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  const activate = async (holdingId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/league/discovery-holdings/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holding_id: holdingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Failed to activate." });
        return;
      }
      setMessage({ type: "ok", text: "Wrestler added to your roster." });
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16, color: "#333" }}>
        Discovery rights
      </h2>
      <p style={{ color: "#555", marginBottom: 16, fontSize: 15 }}>
        Use a discovery pick to hold rights to a wrestler from any company. When they debut on WWE main roster, you have 12 months to activate them to your roster; otherwise they become a free agent.
      </p>

      {unusedDiscoveryPicks.length > 0 && (
        <form onSubmit={createHolding} style={{ marginBottom: 20, padding: 16, background: "#f8f8f8", borderRadius: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Add discovery rights</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 2 }}>Wrestler name *</label>
              <input
                type="text"
                value={wrestlerName}
                onChange={(e) => setWrestlerName(e.target.value)}
                placeholder="e.g. Mercedes Mone"
                style={{ padding: "6px 10px", minWidth: 160 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 2 }}>Company (optional)</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. AEW"
                style={{ padding: "6px 10px", minWidth: 100 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 2 }}>Use pick</label>
              <select
                value={draftPickId}
                onChange={(e) => setDraftPickId(e.target.value)}
                style={{ padding: "6px 10px", minWidth: 140 }}
              >
                {unusedDiscoveryPicks.map((p) => (
                  <option key={p.id} value={p.id}>{getPickLabel(p)}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={loading} style={{ padding: "8px 16px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Adding…" : "Add rights"}
            </button>
          </div>
        </form>
      )}

      {message && (
        <p style={{ marginBottom: 12, color: message.type === "err" ? "#c00" : "#080" }}>{message.text}</p>
      )}

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        {holdings.length === 0 ? (
          <div style={{ padding: 24, color: "#666", fontSize: 15 }}>
            No discovery holdings yet. Use an unused discovery pick above to claim rights to a wrestler from any company.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {holdings.map((h) => (
              <li
                key={h.id}
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {h.wrestler_name}
                  {h.company && <span style={{ fontWeight: 400, color: "#666" }}> ({h.company})</span>}
                </div>
                <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>
                  {statusLabel(h)}
                  {h.contractYears != null && h.status !== "activated" && (
                    <span> · Contract when activated: {h.contractYears} yr</span>
                  )}
                </div>
                {h.status === "rights_held" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <input
                      type="date"
                      value={holdingForDebut === h.id ? debutDate : ""}
                      onChange={(e) => {
                        setDebutDate(e.target.value);
                        setHoldingForDebut(h.id);
                      }}
                      style={{ padding: "6px 10px" }}
                    />
                    <button
                      type="button"
                      disabled={!debutDate || loading}
                      onClick={() => setDebut(h.id)}
                      style={{ padding: "6px 12px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14 }}
                    >
                      Set WWE MR debut (start clock)
                    </button>
                  </div>
                )}
                {h.status === "clock_started" && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => activate(h.id)}
                    style={{ padding: "6px 12px", background: "#0a0", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14 }}
                  >
                    Activate to roster
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
