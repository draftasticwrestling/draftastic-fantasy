"use client";

import Link from "next/link";
import type { RosterEntry } from "@/lib/rosters";
import { groupRosterByContract } from "@/lib/rosters";

type WrestlerInfo = { brand: string | null; image_url: string | null; dob: string | null };

/** Roster entry with slug and totalPoints for team page display. */
export type RosterDisplayEntry = RosterEntry & { slug?: string; totalPoints?: number };

const BRAND_STYLES: Record<string, { stripBg: string; label: string }> = {
  Raw: { stripBg: "#8B1538", label: "RAW" },
  SmackDown: { stripBg: "#0A2463", label: "SMACKDOWN" },
  NXT: { stripBg: "#2C2C2C", label: "NXT" },
  Other: { stripBg: "#4a4a4a", label: "—" },
};

function normalizeBrand(brand: string | null): string {
  if (!brand || !brand.trim()) return "Other";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt") return "NXT";
  return "Other";
}

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob || !dob.trim()) return null;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age >= 0 ? age : null;
}

function nameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type Props = {
  roster: RosterDisplayEntry[];
  wrestlerMap: Record<string, WrestlerInfo>;
  ownerTotal?: number;
};

export default function RosterDisplay({ roster, wrestlerMap, ownerTotal }: Props) {
  const groups = groupRosterByContract(roster);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {typeof ownerTotal === "number" && (
        <p style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#111" }}>
          Team total: <span style={{ color: "#c00" }}>{ownerTotal}</span> pts
        </p>
      )}
      {groups.map(({ tier, entries }) => (
        <div
          key={tier}
          style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid #e8e8e8",
              background: "#fafafa",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#111",
              textAlign: "center",
            }}
          >
            {tier}
          </div>
          <div style={{ padding: "0 0 0 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 20px 10px 0",
                borderBottom: "2px solid #e0e0e0",
                fontSize: 12,
                fontWeight: 700,
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <div style={{ width: 44 + 72, flexShrink: 0 }} />
              <div style={{ flex: 1, paddingLeft: 16 }}>Name</div>
              <div style={{ width: 56, flexShrink: 0, textAlign: "right", paddingRight: 8 }}>Age</div>
              <div style={{ width: 72, flexShrink: 0, textAlign: "right" }}>Pts</div>
            </div>
            {entries.map((entry, i) => {
              const info = wrestlerMap[nameKey(entry.name)];
              const brand = info ? normalizeBrand(info.brand) : "Other";
              const style = BRAND_STYLES[brand] ?? BRAND_STYLES.Other;
              const age = info?.dob ? calculateAge(info.dob) : null;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    minHeight: 80,
                    borderBottom: i < entries.length - 1 ? "1px solid #eee" : "none",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      flexShrink: 0,
                      background: style.stripBg,
                      alignSelf: "stretch",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        transform: "rotate(-180deg)",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        color: "#fff",
                      }}
                    >
                      {style.label}
                    </span>
                  </div>
                  <div
                    style={{
                      width: 72,
                      flexShrink: 0,
                      padding: 10,
                      background: "#fff",
                      borderRight: "1px solid #eee",
                    }}
                  >
                    {info?.image_url ? (
                      <img
                        src={info.image_url}
                        alt={entry.name}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: "cover",
                          borderRadius: "50%",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: "50%",
                          background: "#f0f0f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#999",
                          fontSize: 20,
                        }}
                      >
                        —
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: "12px 20px",
                      fontWeight: 600,
                      fontSize: 16,
                      color: "#111",
                    }}
                  >
                    {entry.slug ? (
                      <Link
                        href={`/wrestlers/${encodeURIComponent(entry.slug)}`}
                        style={{ color: "#1a73e8", textDecoration: "none" }}
                      >
                        {entry.name}
                      </Link>
                    ) : (
                      entry.name
                    )}
                  </div>
                  <div
                    style={{
                      width: 56,
                      flexShrink: 0,
                      padding: "12px 8px",
                      textAlign: "right",
                      color: "#333",
                      fontSize: 15,
                    }}
                  >
                    {age != null ? age : "—"}
                  </div>
                  <div
                    style={{
                      width: 72,
                      flexShrink: 0,
                      padding: "12px 16px 12px 8px",
                      textAlign: "right",
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#c00",
                    }}
                  >
                    {typeof entry.totalPoints === "number" ? entry.totalPoints : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
