"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  compareSalaryCapPoolRows,
  SalaryCapPoolNameCell,
  SalaryCapPoolStatsCells,
  SalaryCapPoolTableHead,
  type SalaryCapPoolSortKey,
  type SalaryCapWrestlerOption,
} from "@/app/leagues/[slug]/salary-cap/SalaryCapRosterBuilder";
import {
  addFreeAgentAction,
  loadSalaryCapFreeAgentPoolAction,
  type SalaryCapFreeAgentPoolPayload,
} from "./actions";

type RosterWrestler = { id: string; name: string | null };

type Props = {
  leagueSlug: string;
  myRosterWrestlers: RosterWrestler[];
  rosterSize: number;
  tradeLockedWrestlerIds?: string[];
  initialWrestlerId?: string | null;
};

export function SalaryCapFreeAgentPicker({
  leagueSlug,
  myRosterWrestlers,
  rosterSize,
  tradeLockedWrestlerIds = [],
  initialWrestlerId,
}: Props) {
  const [open, setOpen] = useState(Boolean(initialWrestlerId?.trim()));
  const [poolData, setPoolData] = useState<SalaryCapFreeAgentPoolPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SalaryCapPoolSortKey>("total2026");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingAdd, setPendingAdd] = useState<SalaryCapWrestlerOption | null>(null);
  const [dropWrestlerId, setDropWrestlerId] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const tradeLocked = useMemo(
    () => new Set(tradeLockedWrestlerIds.map((id) => String(id).trim()).filter(Boolean)),
    [tradeLockedWrestlerIds]
  );

  const loadPool = useCallback(async () => {
    setLoadError(null);
    setLoadingPool(true);
    try {
      const res = await loadSalaryCapFreeAgentPoolAction(leagueSlug);
      if ("error" in res) {
        setLoadError(res.error);
        setPoolData(null);
      } else {
        setPoolData(res);
      }
    } finally {
      setLoadingPool(false);
    }
  }, [leagueSlug]);

  const handleOpen = () => {
    setOpen(true);
  };

  useEffect(() => {
    if (open && !poolData && !loadingPool && !loadError) {
      void loadPool();
    }
  }, [open, poolData, loadingPool, loadError, loadPool]);

  const onRosterIds = useMemo(
    () => new Set(poolData?.myRosterIds ?? myRosterWrestlers.map((w) => w.id)),
    [poolData?.myRosterIds, myRosterWrestlers]
  );

  const budget = poolData?.budget ?? 0;
  const spent = poolData?.spent ?? 0;
  const seasonRemaining = budget - spent;
  const weeklyAddRemaining = poolData?.weeklyAddRemaining ?? 0;
  const sortMult = sortDir === "asc" ? 1 : -1;

  const filteredPool = useMemo(() => {
    if (!poolData) return [];
    const q = search.trim().toLowerCase();
    return poolData.pool.filter(
      (w) =>
        !onRosterIds.has(w.id) &&
        (!q || w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q))
    );
  }, [poolData, onRosterIds, search]);

  const sortedAvailable = useMemo(() => {
    return [...filteredPool].sort((a, b) => compareSalaryCapPoolRows(a, b, sortKey, sortMult));
  }, [filteredPool, sortKey, sortMult]);

  function handleSort(key: SalaryCapPoolSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function addDisabledReason(w: SalaryCapWrestlerOption): string | null {
    if (onRosterIds.has(w.id)) return "Already on your roster";
    if (w.salaryCapCost > seasonRemaining) return `Need $${w.salaryCapCost - seasonRemaining} more cap room`;
    if (w.salaryCapCost > weeklyAddRemaining) return "Weekly signing budget exceeded";
    if (myRosterWrestlers.length >= rosterSize && rosterSize > 0) {
      return "Roster full — drop someone first";
    }
    return null;
  }

  function needsDropFor(w: SalaryCapWrestlerOption): boolean {
    if (myRosterWrestlers.length >= rosterSize && rosterSize > 0) return true;
    if (w.salaryCapCost > seasonRemaining) return true;
    return false;
  }

  function confirmAdd(w: SalaryCapWrestlerOption, dropId: string | null) {
    setMessage(null);
    startTransition(async () => {
      const result = await addFreeAgentAction(leagueSlug, w.id, dropId);
      if (result.error) {
        setMessage({ type: "err", text: result.error });
        return;
      }
      setMessage({ type: "ok", text: `${w.name} added to your roster.` });
      setPendingAdd(null);
      setDropWrestlerId("");
      await loadPool();
    });
  }

  function handleAddClick(w: SalaryCapWrestlerOption) {
    const block = addDisabledReason(w);
    if (block && !needsDropFor(w)) {
      setMessage({ type: "err", text: block });
      return;
    }
    if (needsDropFor(w)) {
      setPendingAdd(w);
      setDropWrestlerId("");
      setMessage(null);
      return;
    }
    confirmAdd(w, null);
  }

  function handleConfirmWithDrop() {
    if (!pendingAdd) return;
    if (!dropWrestlerId.trim()) {
      setMessage({ type: "err", text: "Select a wrestler to drop." });
      return;
    }
    if (tradeLocked.has(dropWrestlerId.trim())) {
      setMessage({
        type: "err",
        text: "That wrestler is tied to a pending trade. Pick someone else or finish/cancel the trade first.",
      });
      return;
    }
    confirmAdd(pendingAdd, dropWrestlerId.trim());
  }

  return (
    <div className="salary-cap-fa-picker">
      {!open ? (
        <button type="button" className="app-button" onClick={handleOpen}>
          Browse free agents
        </button>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              className="app-button app-button--secondary"
              style={{ fontSize: 13 }}
              onClick={() => setOpen(false)}
            >
              Close list
            </button>
            <button
              type="button"
              className="app-button app-button--secondary"
              style={{ fontSize: 13 }}
              disabled={loadingPool}
              onClick={() => void loadPool()}
            >
              {loadingPool ? "Refreshing…" : "Refresh list"}
            </button>
          </div>

          {poolData ? (
            <div
              className="salary-cap-summary"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-elevated)",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Season cap left</div>
                <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--color-blue)" }}>
                  ${seasonRemaining}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Weekly signings left</div>
                <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>${weeklyAddRemaining}</div>
              </div>
              <div style={{ flex: "1 1 180px", fontSize: 13, color: "var(--color-text-muted)", alignSelf: "center" }}>
                Same pool as roster build: headshots, costs, and 2026 stats. Signings take effect immediately.
              </div>
            </div>
          ) : null}

          {loadError ? (
            <p style={{ color: "var(--color-red)", marginBottom: 12 }}>{loadError}</p>
          ) : null}

          {loadingPool && !poolData ? (
            <p style={{ color: "var(--color-text-muted)" }}>Loading wrestlers…</p>
          ) : null}

          {poolData ? (
            <div className="salary-cap-pool__header" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: "1rem", margin: 0 }}>Available wrestlers</h3>
              <input
                type="search"
                className="salary-cap-pool__search"
                placeholder="Search name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search free agents"
              />
            </div>
          ) : null}

          {poolData ? (
            <div className="salary-cap-pool__scroll">
              <table className="salary-cap-pool__table">
                <thead>
                  <SalaryCapPoolTableHead sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </thead>
                <tbody>
                  {sortedAvailable.map((w) => {
                    const rating = w.rating2k26 ?? w.rating2k25 ?? null;
                    const disabled = addDisabledReason(w);
                    const canTryWithDrop = needsDropFor(w) && w.salaryCapCost <= weeklyAddRemaining;
                    return (
                      <tr key={w.id} className={w.currentChampionship ? "salary-cap-pool__row--champ" : undefined}>
                        <SalaryCapPoolNameCell
                          name={w.name}
                          imageUrl={w.imageUrl}
                          brand={w.brand}
                          status={w.status}
                          currentChampionship={w.currentChampionship}
                          championBeltImageUrl={w.championBeltImageUrl}
                        />
                        <td className="salary-cap-pool__num salary-cap-pool__cost">${w.salaryCapCost}</td>
                        <SalaryCapPoolStatsCells stats={w.stats2026} rating2k={rating} />
                        <td>
                          <button
                            type="button"
                            className="app-button"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                            disabled={pending || (!!disabled && !canTryWithDrop)}
                            title={disabled ?? undefined}
                            onClick={() => handleAddClick(w)}
                          >
                            Sign
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {poolData && sortedAvailable.length === 0 ? (
            <p style={{ padding: 12, color: "var(--color-text-muted)" }}>
              {search.trim() ? "No wrestlers match your search." : "Everyone with a salary value is already on your roster."}
            </p>
          ) : null}
        </>
      )}

      {pendingAdd ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-elevated)",
          }}
        >
          <p style={{ margin: "0 0 10px", fontWeight: 700 }}>
            Sign {pendingAdd.name} (${pendingAdd.salaryCapCost}) — drop someone to make room
          </p>
          <label htmlFor="sc-fa-drop" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Drop from your roster
          </label>
          <select
            id="sc-fa-drop"
            value={dropWrestlerId}
            onChange={(e) => setDropWrestlerId(e.target.value)}
            style={{ padding: "8px 12px", minWidth: 220, marginBottom: 10 }}
          >
            <option value="">Select wrestler to drop…</option>
            {myRosterWrestlers.map((w) => (
              <option key={w.id} value={w.id} disabled={tradeLocked.has(w.id)}>
                {tradeLocked.has(w.id) ? `${w.name ?? w.id} (pending trade)` : (w.name ?? w.id)}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="app-button"
              disabled={pending || !dropWrestlerId.trim()}
              onClick={handleConfirmWithDrop}
            >
              {pending ? "Signing…" : "Confirm sign"}
            </button>
            <button
              type="button"
              className="app-button app-button--secondary"
              disabled={pending}
              onClick={() => {
                setPendingAdd(null);
                setDropWrestlerId("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            fontSize: 14,
            color: message.type === "err" ? "var(--color-red)" : "var(--color-success-muted)",
          }}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
