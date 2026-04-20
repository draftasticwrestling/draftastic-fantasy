"use client";

import { useEffect, useMemo, useState } from "react";
import { siteLogoHref } from "@/lib/siteLogo";

type Props = {
  leagueSlug: string;
  seasonEndYmd: string;
  placement: number;
  totalMembers: number;
};

function ordinal(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function placementMessage(placement: number, totalMembers: number): string {
  const lastPlace = totalMembers;
  if (placement === 1) {
    return "Congrats, Champ! You've won the league. The whole league acknowledges you!";
  }
  if (placement === 2) {
    return "2nd place! You made it to the main event but came up short. Happens to the best of 'em. There is always next season.";
  }
  if (placement === lastPlace) {
    return "Yikes. Last place. Time to hit the training center for bit, but you'll be back on the main roster in no time.";
  }
  if (placement === 5) {
    return "Well, hey, at least you weren't last! Better luck next season.";
  }
  if (placement === 3) {
    return "3rd place. Time to hit the gym and make this off-season count.";
  }
  if (placement === 4) {
    return "4th place. Time to hit the gym and make this off-season count.";
  }
  return `${ordinal(placement)} place. Time to hit the gym and make this off-season count.`;
}

export default function SeasonCompletePlacementModal({
  leagueSlug,
  seasonEndYmd,
  placement,
  totalMembers,
}: Props) {
  const [open, setOpen] = useState(false);
  const storageKey = useMemo(
    () => `draftastic-season-complete-modal:${leagueSlug}:${seasonEndYmd}`,
    [leagueSlug, seasonEndYmd]
  );

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (seen === "1") return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  };

  const message = placementMessage(placement, totalMembers);
  const firstPlace = placement === 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-complete-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(0,0,0,0.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={close}
    >
      <div
        style={{
          width: "min(92vw, 560px)",
          borderRadius: 14,
          border: "1px solid var(--color-border, #ddd)",
          background: "var(--color-bg-surface, #fff)",
          boxShadow: "0 12px 28px rgba(0,0,0,0.24)",
          padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="season-complete-title" style={{ margin: "0 0 8px", fontSize: "1.2rem" }}>
          Season Complete
        </h2>
        {firstPlace ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={siteLogoHref()}
            alt="Draftastic championship belt"
            style={{
              display: "block",
              margin: "2px auto 10px",
              width: 70,
              height: "auto",
            }}
          />
        ) : null}
        <p style={{ margin: "0 0 10px", color: "var(--color-text-muted, #555)" }}>
          Final standings are in.
        </p>
        <p style={{ margin: "0 0 14px", fontWeight: 700 }}>
          You finished {ordinal(placement)} out of {totalMembers}.
        </p>
        <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={close}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              background: "var(--color-blue, #1a73e8)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
