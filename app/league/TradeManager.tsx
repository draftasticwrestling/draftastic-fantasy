"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LEAGUE_MEMBERS } from "@/lib/league";
import { getPickLabel } from "@/lib/draftPicks";

type TradeLegEnriched = {
  id: string;
  from_owner_slug: string;
  to_owner_slug: string;
  wrestler_id: string | null;
  draft_pick_id: string | null;
  wrestler_name?: string;
  pick_label?: string;
};

type TradeEnriched = {
  id: string;
  trade_date: string;
  notes: string | null;
  legs: TradeLegEnriched[];
};

type LegInput = {
  from_owner_slug: string;
  to_owner_slug: string;
  wrestler_id: string;
  draft_pick_id: string;
};

type RosterAssignments = Record<string, { wrestler_id: string; contract: string | null }[]>;
type PicksByOwner = Record<string, Array<{ id: string; pick_type: string; round_number: number | null; discovery_number: number | null; contract_years?: number }>>;

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString();
  } catch {
    return s;
  }
}

function ownerName(slug: string): string {
  return LEAGUE_MEMBERS.find((m) => m.slug === slug)?.name ?? slug;
}

export default function TradeManager() {
  const router = useRouter();
  const [trades, setTrades] = useState<TradeEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [tradeDate, setTradeDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [legs, setLegs] = useState<LegInput[]>([]);
  const [notes, setNotes] = useState("");

  const [assignments, setAssignments] = useState<RosterAssignments>({});
  const [picksByOwner, setPicksByOwner] = useState<PicksByOwner>({});
  const [wrestlerNames, setWrestlerNames] = useState<Record<string, string>>({});
  const [formDataLoaded, setFormDataLoaded] = useState(false);

  const loadTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/league/trades");
      const data = await res.json();
      if (data.trades) setTrades(data.trades);
    } catch {
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFormData = useCallback(async () => {
    try {
      const [rosterRes, picksRes, wrestlersRes] = await Promise.all([
        fetch("/api/league/roster"),
        fetch("/api/league/draft-picks"),
        fetch("/api/wrestlers"),
      ]);
      const rosterData = await rosterRes.json();
      const picksData = await picksRes.json();
      const wrestlersData = await wrestlersRes.json();
      if (rosterData.assignments) setAssignments(rosterData.assignments);
      if (picksData.by_owner) setPicksByOwner(picksData.by_owner);
      const list = wrestlersData?.wrestlers ?? [];
      const names: Record<string, string> = {};
      for (const w of list) {
        names[w.id] = w.name ?? w.id;
      }
      setWrestlerNames(names);
    } catch {
      // keep empty
    } finally {
      setFormDataLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  const addLeg = () => {
    setLegs((prev) => [
      ...prev,
      {
        from_owner_slug: LEAGUE_MEMBERS[0]?.slug ?? "",
        to_owner_slug: LEAGUE_MEMBERS[1]?.slug ?? "",
        wrestler_id: "",
        draft_pick_id: "",
      },
    ]);
  };

  const updateLeg = (index: number, updates: Partial<LegInput>) => {
    setLegs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const removeLeg = (index: number) => {
    setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const wrestlersForOwner = (ownerSlug: string) => assignments[ownerSlug] ?? [];
  const picksForOwner = (ownerSlug: string) => picksByOwner[ownerSlug] ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const payload = legs
      .map((leg) => {
        const wrestlerId = leg.wrestler_id?.trim() || null;
        const draftPickId = leg.draft_pick_id?.trim() || null;
        if (!wrestlerId && !draftPickId) return null;
        if (leg.from_owner_slug === leg.to_owner_slug) return null;
        return {
          from_owner_slug: leg.from_owner_slug,
          to_owner_slug: leg.to_owner_slug,
          wrestler_id: wrestlerId,
          draft_pick_id: draftPickId,
        };
      })
      .filter(Boolean) as Array<{ from_owner_slug: string; to_owner_slug: string; wrestler_id: string | null; draft_pick_id: string | null }>;

    if (!payload.length) {
      setMessage({ type: "err", text: "Add at least one leg (wrestler or draft pick) with different from/to owners." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/league/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade_date: tradeDate, legs: payload, notes: notes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Failed to save trade." });
        return;
      }
      setMessage({ type: "ok", text: "Trade recorded." });
      setLegs([]);
      setNotes("");
      await loadTrades();
      await loadFormData();
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Request failed." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Trades</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Trade date</label>
          <input
            type="date"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            required
            style={{ padding: "8px 12px", fontSize: 16 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>Legs</span>
          <p style={{ margin: "4px 0 8px 0", color: "#555", fontSize: 14 }}>
            For each item moving, choose from owner, to owner, and either a wrestler or a draft pick.
          </p>
        </div>

        {legs.map((leg, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-end",
              marginBottom: 12,
              padding: 12,
              background: "#f8f8f8",
              borderRadius: 8,
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: 2, fontSize: 12 }}>From</label>
              <select
                value={leg.from_owner_slug}
                onChange={(e) => updateLeg(index, { from_owner_slug: e.target.value, wrestler_id: "", draft_pick_id: "" })}
                style={{ padding: "6px 10px", minWidth: 140 }}
              >
                {LEAGUE_MEMBERS.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 2, fontSize: 12 }}>To</label>
              <select
                value={leg.to_owner_slug === leg.from_owner_slug
                  ? LEAGUE_MEMBERS.find((m) => m.slug !== leg.from_owner_slug)?.slug ?? ""
                  : leg.to_owner_slug}
                onChange={(e) => updateLeg(index, { to_owner_slug: e.target.value })}
                style={{ padding: "6px 10px", minWidth: 140 }}
              >
                {LEAGUE_MEMBERS.filter((m) => m.slug !== leg.from_owner_slug).map((m) => (
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label style={{ display: "block", marginBottom: 2, fontSize: 12 }}>Wrestler</label>
              <select
                value={leg.wrestler_id}
                onChange={(e) => updateLeg(index, { wrestler_id: e.target.value, draft_pick_id: "" })}
                style={{ padding: "6px 10px", width: "100%" }}
              >
                <option value="">—</option>
                {formDataLoaded &&
                  wrestlersForOwner(leg.from_owner_slug).map((a) => (
                    <option key={a.wrestler_id} value={a.wrestler_id}>
                      {wrestlerNames[a.wrestler_id] ?? a.wrestler_id}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ minWidth: 160 }}>
              <label style={{ display: "block", marginBottom: 2, fontSize: 12 }}>Or draft pick</label>
              <select
                value={leg.draft_pick_id}
                onChange={(e) => updateLeg(index, { draft_pick_id: e.target.value, wrestler_id: "" })}
                style={{ padding: "6px 10px", width: "100%" }}
              >
                <option value="">—</option>
                {formDataLoaded &&
                  picksForOwner(leg.from_owner_slug).map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPickLabel(p)}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => removeLeg(index)}
              style={{ padding: "6px 10px", color: "#c00", background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addLeg}
          style={{ marginBottom: 12, padding: "8px 14px", border: "1px dashed #888", borderRadius: 6, background: "#fff", cursor: "pointer" }}
        >
          + Add leg
        </button>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Trade deadline deal"
            style={{ padding: "8px 12px", fontSize: 16, width: "100%", maxWidth: 400 }}
          />
        </div>

        {message && (
          <p style={{ marginBottom: 12, color: message.type === "err" ? "#c00" : "#080" }}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || legs.length === 0}
          style={{ padding: "10px 20px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving…" : "Record trade"}
        </button>
      </form>

      <h3 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Trade history</h3>
      {loading ? (
        <p style={{ color: "#666" }}>Loading…</p>
      ) : trades.length === 0 ? (
        <p style={{ color: "#666" }}>No trades recorded yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {trades.map((trade) => (
            <li
              key={trade.id}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{formatDate(trade.trade_date)}</div>
              {trade.notes && <div style={{ color: "#555", marginBottom: 8, fontSize: 14 }}>{trade.notes}</div>}
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15 }}>
                {trade.legs.map((leg) => (
                  <li key={leg.id}>
                    {leg.wrestler_name != null
                      ? `${leg.wrestler_name}`
                      : leg.pick_label ?? "Draft pick"}
                    {" "}from {ownerName(leg.from_owner_slug)} → {ownerName(leg.to_owner_slug)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
