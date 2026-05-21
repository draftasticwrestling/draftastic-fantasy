"use client";

import { useMemo, useState, useTransition } from "react";
import WrestlerHeadshotImage from "@/app/components/WrestlerHeadshotImage";
import type { SalaryCap2026Stats } from "@/lib/salaryCap2026Stats";
import {
  addSalaryCapWrestlerAction,
  completeSalaryCapBuildAction,
  removeSalaryCapWrestlerAction,
} from "./actions";

export type SalaryCapWrestlerOption = {
  id: string;
  name: string;
  salaryCapCost: number;
  brand?: string | null;
  imageUrl?: string | null;
  gender?: string | null;
  status?: string | null;
  rating2k26?: number | null;
  rating2k25?: number | null;
  stats2026?: SalaryCap2026Stats | null;
  currentChampionship?: string | null;
  championBeltImageUrl?: string | null;
};

export type SalaryCapRosterEntry = {
  wrestlerId: string;
  name: string;
  salaryCapCost: number;
  imageUrl?: string | null;
  brand?: string | null;
  status?: string | null;
  stats2026?: SalaryCap2026Stats | null;
  currentChampionship?: string | null;
  championBeltImageUrl?: string | null;
};

function isInjured(status: string | null | undefined): boolean {
  if (!status) return false;
  return /injur/i.test(status.trim());
}

export type SalaryCapPoolSortKey = "name" | "cost" | "rating2k" | "total2026" | "rs" | "ple" | "belt";
type SortKey = SalaryCapPoolSortKey;

function ratingForSort(w: { rating2k26?: number | null; rating2k25?: number | null }): number {
  const r = w.rating2k26 ?? w.rating2k25;
  return r != null && !Number.isNaN(r) ? r : -1;
}

function total2026ForSort(stats?: SalaryCap2026Stats | null): number {
  if (!stats) return -1;
  return stats.totalPoints ?? stats.rsPoints + stats.plePoints + stats.beltPoints;
}

export function compareSalaryCapPoolRows(
  a: SalaryCapWrestlerOption,
  b: SalaryCapWrestlerOption,
  sortKey: SortKey,
  dir: 1 | -1
): number {
  let out = 0;
  switch (sortKey) {
    case "name":
      out = a.name.localeCompare(b.name);
      break;
    case "cost":
      out = a.salaryCapCost - b.salaryCapCost;
      break;
    case "rating2k":
      out = ratingForSort(a) - ratingForSort(b);
      break;
    case "total2026":
      out = total2026ForSort(a.stats2026) - total2026ForSort(b.stats2026);
      break;
    case "rs":
      out = (a.stats2026?.rsPoints ?? -1) - (b.stats2026?.rsPoints ?? -1);
      break;
    case "ple":
      out = (a.stats2026?.plePoints ?? -1) - (b.stats2026?.plePoints ?? -1);
      break;
    case "belt":
      out = (a.stats2026?.beltPoints ?? -1) - (b.stats2026?.beltPoints ?? -1);
      break;
  }
  if (out === 0) out = a.name.localeCompare(b.name);
  return out * dir;
}

function comparePoolRows(
  a: SalaryCapWrestlerOption,
  b: SalaryCapWrestlerOption,
  sortKey: SortKey,
  dir: 1 | -1
): number {
  return compareSalaryCapPoolRows(a, b, sortKey, dir);
}

function rosterToSortRow(r: SalaryCapRosterEntry, pool: SalaryCapWrestlerOption[]): SalaryCapWrestlerOption {
  const w = pool.find((p) => p.id === r.wrestlerId);
  return {
    id: r.wrestlerId,
    name: r.name,
    salaryCapCost: r.salaryCapCost,
    brand: r.brand ?? w?.brand,
    imageUrl: r.imageUrl ?? w?.imageUrl,
    gender: w?.gender,
    status: r.status ?? w?.status,
    rating2k26: w?.rating2k26,
    rating2k25: w?.rating2k25,
    stats2026: r.stats2026 ?? w?.stats2026,
    currentChampionship: r.currentChampionship ?? w?.currentChampionship,
    championBeltImageUrl: r.championBeltImageUrl ?? w?.championBeltImageUrl,
  };
}

export function SalaryCapPoolSortableTh({
  label,
  sortKey: key,
  activeSort,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeSort === key;
  return (
    <th className={className}>
      <button
        type="button"
        className={`salary-cap-pool__sort${active ? " salary-cap-pool__sort--active" : ""}`}
        onClick={() => onSort(key)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {active ? <span aria-hidden>{sortDir === "asc" ? " ↑" : " ↓"}</span> : null}
      </button>
    </th>
  );
}

export function SalaryCapPoolTableHead({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <tr>
      <SalaryCapPoolSortableTh label="Wrestler" sortKey="name" activeSort={sortKey} sortDir={sortDir} onSort={onSort} />
      <SalaryCapPoolSortableTh
        label="Cost"
        sortKey="cost"
        activeSort={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="salary-cap-pool__num"
      />
      <SalaryCapPoolSortableTh
        label="2K"
        sortKey="rating2k"
        activeSort={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="salary-cap-pool__num"
      />
      <SalaryCapPoolSortableTh
        label="2026"
        sortKey="total2026"
        activeSort={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="salary-cap-pool__num"
      />
      <SalaryCapPoolSortableTh
        label="R/S"
        sortKey="rs"
        activeSort={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="salary-cap-pool__num"
      />
      <SalaryCapPoolSortableTh
        label="PLE"
        sortKey="ple"
        activeSort={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="salary-cap-pool__num"
      />
      <SalaryCapPoolSortableTh
        label="Belt"
        sortKey="belt"
        activeSort={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        className="salary-cap-pool__num"
      />
      <th />
    </tr>
  );
}

type Props = {
  leagueSlug: string;
  budget: number;
  spent: number;
  roster: SalaryCapRosterEntry[];
  pool: SalaryCapWrestlerOption[];
  isCommissioner: boolean;
  draftStatus: string | null;
};

function formatPts(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function SalaryCapPoolStatsCells({ stats, rating2k }: { stats?: SalaryCap2026Stats | null; rating2k?: number | null }) {
  const total = stats?.totalPoints ?? (stats ? stats.rsPoints + stats.plePoints + stats.beltPoints : null);
  return (
    <>
      <td className="salary-cap-pool__num">{rating2k != null ? rating2k : "—"}</td>
      <td className="salary-cap-pool__num salary-cap-pool__total">{formatPts(total)}</td>
      <td className="salary-cap-pool__num">{formatPts(stats?.rsPoints)}</td>
      <td className="salary-cap-pool__num">{formatPts(stats?.plePoints)}</td>
      <td className="salary-cap-pool__num">{formatPts(stats?.beltPoints)}</td>
    </>
  );
}

export function SalaryCapPoolNameCell({
  name,
  imageUrl,
  brand,
  status,
  currentChampionship,
  championBeltImageUrl,
}: {
  name: string;
  imageUrl?: string | null;
  brand?: string | null;
  status?: string | null;
  currentChampionship?: string | null;
  championBeltImageUrl?: string | null;
}) {
  const injured = isInjured(status);
  return (
    <td className="salary-cap-pool__name">
      <span className="salary-cap-pool__name-inner">
        <WrestlerHeadshotImage
          src={imageUrl ?? null}
          alt=""
          width={40}
          height={40}
          sizes="40px"
          className="salary-cap-pool__headshot"
        />
        <span className="salary-cap-pool__name-text">
          <span className="salary-cap-pool__wrestler-name">
            {name}
            {injured ? <span className="salary-cap-pool__inj">INJ</span> : null}
          </span>
          {brand ? <span className="salary-cap-pool__brand">{brand}</span> : null}
          {currentChampionship ? (
            <span className="salary-cap-pool__champion">
              {championBeltImageUrl ? (
                <img
                  src={championBeltImageUrl}
                  alt=""
                  width={48}
                  height={28}
                  className="salary-cap-pool__belt"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <span>{currentChampionship}</span>
            </span>
          ) : null}
        </span>
      </span>
    </td>
  );
}

export function SalaryCapRosterBuilder({
  leagueSlug,
  budget,
  spent,
  roster,
  pool,
  isCommissioner,
  draftStatus,
}: Props) {
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total2026");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pending, startTransition] = useTransition();
  const remaining = budget - spent;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const onRosterIds = useMemo(() => new Set(roster.map((r) => r.wrestlerId)), [roster]);
  const sortMult = sortDir === "asc" ? 1 : -1;

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter(
      (w) =>
        !onRosterIds.has(w.id) &&
        (!q || w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q))
    );
  }, [pool, onRosterIds, search]);

  const sortedAvailable = useMemo(() => {
    return [...filteredPool].sort((a, b) => comparePoolRows(a, b, sortKey, sortMult));
  }, [filteredPool, sortKey, sortMult]);

  const sortedRoster = useMemo(() => {
    const rows = roster.map((r) => ({ entry: r, sort: rosterToSortRow(r, pool) }));
    rows.sort((a, b) => comparePoolRows(a.sort, b.sort, sortKey, sortMult));
    return rows.map((r) => r.entry);
  }, [roster, pool, sortKey, sortMult]);

  function run(fn: () => Promise<{ error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setMessage({ type: "err", text: res.error });
      else setMessage({ type: "ok", text: "Updated." });
    });
  }

  return (
    <div>
      <div
        className="salary-cap-summary"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-elevated)",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Budget</div>
          <div style={{ fontWeight: 800, fontSize: "1.35rem" }}>${budget}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Spent</div>
          <div style={{ fontWeight: 700, fontSize: "1.35rem" }}>${spent}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Remaining</div>
          <div style={{ fontWeight: 700, fontSize: "1.35rem", color: "var(--color-blue)" }}>${remaining}</div>
        </div>
        <div style={{ flex: "1 1 200px", fontSize: 13, color: "var(--color-text-muted)", alignSelf: "center" }}>
          Build any roster size within your cap. Wrestlers are <strong>not exclusive</strong> — multiple factions can
          roster the same star. Scoring matches Total Season Points. 2026 stats are year-to-date (R/S, PLE, belt).
        </div>
      </div>

      {message ? (
        <p
          style={{
            marginBottom: 16,
            color: message.type === "err" ? "var(--color-red)" : "var(--color-success-muted)",
          }}
        >
          {message.text}
        </p>
      ) : null}

      {isCommissioner && draftStatus !== "completed" ? (
        <p style={{ marginBottom: 20 }}>
          <button
            type="button"
            className="app-button"
            disabled={pending}
            onClick={() => run(() => completeSalaryCapBuildAction(leagueSlug))}
          >
            {pending ? "Saving…" : "Mark roster build complete (commissioner)"}
          </button>
        </p>
      ) : null}

      <div className="salary-cap-grid">
        <section>
          <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Your roster ({roster.length})</h2>
          {roster.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>No wrestlers yet. Add from the pool on the right.</p>
          ) : (
            <div className="salary-cap-pool__scroll">
              <table className="salary-cap-pool__table">
                <thead>
                  <SalaryCapPoolTableHead sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </thead>
                <tbody>
                  {sortedRoster.map((r) => {
                    const w = pool.find((p) => p.id === r.wrestlerId);
                    const rating = w?.rating2k26 ?? w?.rating2k25 ?? null;
                    return (
                      <tr key={r.wrestlerId} className={r.currentChampionship ? "salary-cap-pool__row--champ" : undefined}>
                        <SalaryCapPoolNameCell
                          name={r.name}
                          imageUrl={r.imageUrl}
                          brand={r.brand ?? w?.brand}
                          status={r.status ?? w?.status}
                          currentChampionship={r.currentChampionship ?? w?.currentChampionship}
                          championBeltImageUrl={r.championBeltImageUrl ?? w?.championBeltImageUrl}
                        />
                        <td className="salary-cap-pool__num salary-cap-pool__cost">${r.salaryCapCost}</td>
                        <SalaryCapPoolStatsCells stats={r.stats2026} rating2k={rating} />
                        <td>
                          <button
                            type="button"
                            className="app-button app-button--secondary"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                            disabled={pending}
                            onClick={() => run(() => removeSalaryCapWrestlerAction(leagueSlug, r.wrestlerId))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="salary-cap-pool__header">
            <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Available wrestlers</h2>
            <input
              type="search"
              className="salary-cap-pool__search"
              placeholder="Search name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search wrestlers"
            />
          </div>
          <div className="salary-cap-pool__scroll">
            <table className="salary-cap-pool__table">
              <thead>
                <SalaryCapPoolTableHead sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </thead>
              <tbody>
                {sortedAvailable.map((w) => {
                  const rating = w.rating2k26 ?? w.rating2k25 ?? null;
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
                          disabled={pending || w.salaryCapCost > remaining}
                          onClick={() => run(() => addSalaryCapWrestlerAction(leagueSlug, w.id))}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortedAvailable.length === 0 ? (
            <p style={{ padding: 12, color: "var(--color-text-muted)" }}>
              {search.trim() ? "No wrestlers match your search." : "No wrestlers available with a salary value."}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
