"use client";

import type { CSSProperties } from "react";
import { useSalaryCapTableActions } from "./SalaryCapTableActionsProvider";

type Props = {
  wrestlerId: string;
  wrestlerName: string | null;
  isOnMyRoster: boolean;
  tradeLocked?: boolean;
  salaryCapCost?: number | null;
};

const dropBtnStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 6,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  cursor: "pointer",
  border: "none",
};

const addBtnStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

export function SalaryCapTableAddDrop({
  wrestlerId,
  wrestlerName,
  isOnMyRoster,
  tradeLocked = false,
  salaryCapCost = null,
}: Props) {
  const actions = useSalaryCapTableActions();
  const name = wrestlerName || wrestlerId;
  const cost = salaryCapCost ?? 5;

  if (!actions) {
    return <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>—</span>;
  }

  const { pending, requestDrop, requestAdd, getAddButtonState } = actions;

  if (isOnMyRoster) {
    if (tradeLocked) {
      return (
        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }} title="Pending trade">
          Locked
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={pending}
        style={{ ...dropBtnStyle, background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}
        title={`Drop ${name}`}
        onClick={() => requestDrop(wrestlerId, name)}
      >
        Drop
      </button>
    );
  }

  const { isDisabled, disabledReason } = getAddButtonState(cost, wrestlerId);
  const addDisabled = pending || isDisabled;

  return (
    <button
      type="button"
      disabled={addDisabled}
      style={{
        ...addBtnStyle,
        borderRadius: 6,
        border: addDisabled ? "1px solid #d1d5db" : "none",
        background: addDisabled ? "#e5e7eb" : "var(--color-blue)",
        color: addDisabled ? "#9ca3af" : "#fff",
        cursor: addDisabled ? "not-allowed" : "pointer",
      }}
      title={disabledReason ?? `Add ${name}`}
      onClick={() => requestAdd(wrestlerId, wrestlerName, cost)}
    >
      Add
    </button>
  );
}
