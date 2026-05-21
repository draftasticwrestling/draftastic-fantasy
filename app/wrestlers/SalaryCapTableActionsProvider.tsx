"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  addFreeAgentAction,
  dropWrestlerAction,
} from "@/app/leagues/[slug]/team/actions";
import { SALARY_CAP_MAX_ROSTER_SIZE } from "@/lib/leagueStructure";
import type { SalaryCapRosterActionsConfig } from "@/lib/salaryCapRosterActionsTypes";

type PendingAdd = {
  id: string;
  name: string;
  salaryCapCost: number;
};

export type SalaryCapAddButtonState = {
  disabledReason: string | null;
  canTryWithDrop: boolean;
  isDisabled: boolean;
};

type SalaryCapTableActionsContextValue = {
  config: SalaryCapRosterActionsConfig;
  leagueSlug: string;
  pending: boolean;
  message: { type: "ok" | "err"; text: string } | null;
  getAddButtonState: (salaryCapCost: number, wrestlerId: string) => SalaryCapAddButtonState;
  requestDrop: (wrestlerId: string, wrestlerName: string) => void;
  requestAdd: (wrestlerId: string, wrestlerName: string | null, salaryCapCost: number) => void;
};

const SalaryCapTableActionsContext = createContext<SalaryCapTableActionsContextValue | null>(null);

export function useSalaryCapTableActions(): SalaryCapTableActionsContextValue | null {
  return useContext(SalaryCapTableActionsContext);
}

type ProviderProps = {
  leagueSlug: string;
  config: SalaryCapRosterActionsConfig;
  children: ReactNode;
};

export function SalaryCapTableActionsProvider({ leagueSlug, config, children }: ProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [dropWrestlerId, setDropWrestlerId] = useState("");

  const tradeLocked = useMemo(
    () =>
      new Set(
        (config.tradeLockedWrestlerIds ?? [])
          .map((id) => String(id).trim())
          .filter(Boolean)
      ),
    [config.tradeLockedWrestlerIds]
  );

  const effectiveRosterSize =
    config.rosterSize > 0 ? config.rosterSize : SALARY_CAP_MAX_ROSTER_SIZE;
  const rosterCount = config.myRosterIds.length;
  const seasonRemaining = config.budget - config.spent;
  const weeklyAddRemaining = config.weeklyAddRemaining;

  const addDisabledReason = useCallback(
    (cost: number, wrestlerId: string): string | null => {
      if (config.myRosterIds.includes(wrestlerId)) return "Already on your roster";
      if (cost > seasonRemaining) return `Need $${cost - seasonRemaining} more cap room`;
      if (cost > weeklyAddRemaining) return "Weekly add budget exceeded";
      if (rosterCount >= effectiveRosterSize) return "Roster full — drop someone first";
      return null;
    },
    [config.myRosterIds, seasonRemaining, weeklyAddRemaining, rosterCount, effectiveRosterSize]
  );

  const needsDropFor = useCallback(
    (cost: number): boolean => {
      if (rosterCount >= effectiveRosterSize) return true;
      if (cost > seasonRemaining) return true;
      return false;
    },
    [rosterCount, effectiveRosterSize, seasonRemaining]
  );

  const getAddButtonState = useCallback(
    (salaryCapCost: number, wrestlerId: string): SalaryCapAddButtonState => {
      const disabledReason = addDisabledReason(salaryCapCost, wrestlerId);
      const canTryWithDrop =
        needsDropFor(salaryCapCost) && salaryCapCost <= weeklyAddRemaining;
      const isDisabled = Boolean(disabledReason && !canTryWithDrop);
      return { disabledReason, canTryWithDrop, isDisabled };
    },
    [addDisabledReason, needsDropFor, weeklyAddRemaining]
  );

  const confirmAdd = useCallback(
    (add: PendingAdd, dropId: string | null) => {
      setMessage(null);
      startTransition(async () => {
        try {
          const result = await addFreeAgentAction(leagueSlug, add.id, dropId);
          if (result.error) {
            setMessage({ type: "err", text: result.error });
            return;
          }
          setMessage({ type: "ok", text: `${add.name} added to your roster.` });
          setPendingAdd(null);
          setDropWrestlerId("");
          router.refresh();
        } catch (err) {
          setMessage({
            type: "err",
            text: err instanceof Error ? err.message : "Add failed. Try again.",
          });
        }
      });
    },
    [leagueSlug, router]
  );

  const requestAdd = useCallback(
    (wrestlerId: string, wrestlerName: string | null, salaryCapCost: number) => {
      const name = wrestlerName?.trim() || wrestlerId;
      const add: PendingAdd = { id: wrestlerId, name, salaryCapCost };
      const block = addDisabledReason(salaryCapCost, wrestlerId);
      const canTryWithDrop =
        needsDropFor(salaryCapCost) && salaryCapCost <= weeklyAddRemaining;
      if (block && !canTryWithDrop) {
        setMessage({ type: "err", text: block });
        return;
      }
      if (needsDropFor(salaryCapCost)) {
        setPendingAdd(add);
        setDropWrestlerId("");
        setMessage({
          type: "ok",
          text: `Choose who to drop below to add ${name} ($${salaryCapCost}).`,
        });
        return;
      }
      confirmAdd(add, null);
    },
    [addDisabledReason, needsDropFor, confirmAdd]
  );

  const requestDrop = useCallback(
    (wrestlerId: string, wrestlerName: string) => {
      const name = wrestlerName.trim() || wrestlerId;
      if (!window.confirm(`Drop ${name} from your roster?`)) return;
      setMessage(null);
      startTransition(async () => {
        try {
          const result = await dropWrestlerAction(leagueSlug, wrestlerId);
          if (result.error) {
            setMessage({ type: "err", text: result.error });
            return;
          }
          setMessage({ type: "ok", text: `${name} dropped.` });
          router.refresh();
        } catch (err) {
          setMessage({
            type: "err",
            text: err instanceof Error ? err.message : "Drop failed. Try again.",
          });
        }
      });
    },
    [leagueSlug, router]
  );

  const handleConfirmWithDrop = () => {
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
  };

  const ctx: SalaryCapTableActionsContextValue = {
    config,
    leagueSlug,
    pending,
    message,
    getAddButtonState,
    requestDrop,
    requestAdd,
  };

  const dropBar =
    typeof document !== "undefined" && pendingAdd
      ? createPortal(
          <div
            role="dialog"
            aria-label="Drop wrestler to add free agent"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 200,
              padding: "14px 16px max(14px, env(safe-area-inset-bottom))",
              background: "var(--color-bg-surface)",
              borderTop: "2px solid var(--color-blue)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>
                Add {pendingAdd.name} (${pendingAdd.salaryCapCost}) — drop one wrestler
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <select
                  value={dropWrestlerId}
                  onChange={(e) => setDropWrestlerId(e.target.value)}
                  style={{ flex: "1 1 200px", minWidth: 160, padding: "8px 10px", fontSize: 14 }}
                  aria-label="Wrestler to drop"
                >
                  <option value="">Select wrestler to drop…</option>
                  {config.myRosterWrestlers.map((w) => {
                    const locked = tradeLocked.has(w.id);
                    const label = `${w.name || w.id} ($${w.salaryCapCost})${locked ? " — trade locked" : ""}`;
                    return (
                      <option key={w.id} value={w.id} disabled={locked}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="app-button"
                  disabled={pending || !dropWrestlerId.trim()}
                  onClick={handleConfirmWithDrop}
                >
                  {pending ? "Adding…" : "Confirm add"}
                </button>
                <button
                  type="button"
                  className="app-button app-button--secondary"
                  disabled={pending}
                  onClick={() => {
                    setPendingAdd(null);
                    setDropWrestlerId("");
                    setMessage(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const statusBar =
    message && !pendingAdd
      ? createPortal(
          <div
            style={{
              position: "fixed",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: pendingAdd ? 120 : 16,
              zIndex: 199,
              maxWidth: "min(90vw, 480px)",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: message.type === "ok" ? "#dcfce7" : "#fee2e2",
              color: message.type === "ok" ? "#166534" : "#991b1b",
              border: `1px solid ${message.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}
          >
            {message.text}
            <button
              type="button"
              onClick={() => setMessage(null)}
              style={{
                marginLeft: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                textDecoration: "underline",
              }}
            >
              Dismiss
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <SalaryCapTableActionsContext.Provider value={ctx}>
      {children}
      {dropBar}
      {statusBar}
    </SalaryCapTableActionsContext.Provider>
  );
}
