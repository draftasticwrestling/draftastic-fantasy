"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getWrestlerFullImageUrl } from "@/lib/wrestlerImages";

const SORT_OPTIONS = [
  { value: "2k", label: "2K Rating" },
  { value: "rs", label: "R/S Points" },
  { value: "ple", label: "PLE Points" },
  { value: "belt", label: "Belt Points" },
  { value: "ppm", label: "PPM" },
  { value: "total", label: "Total Points" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export type RosterCardWrestler = {
  id: string;
  name: string | null;
  brand?: string | null;
  rsPoints: number;
  plePoints: number;
  beltPoints: number;
  totalPoints: number;
  mw: number;
  rating_2k26?: number | null;
  rating_2k25?: number | null;
  championBeltImageUrl?: string | null;
  image_url?: string | null;
};

const RAW_OUTLINE = "#7a1515";
const RAW_GRADIENT = "linear-gradient(180deg, #4a0808 0%, #6b1010 50%, #8b2020 100%)";
const SMACKDOWN_OUTLINE = "#1a3a6c";
const SMACKDOWN_GRADIENT = "linear-gradient(180deg, #0a2244 0%, #152a52 50%, #1e3d6e 100%)";
const GOLD_FRAME = "linear-gradient(145deg, #d4af37 0%, #b8860b 30%, #8b6914 70%, #c9a227 100%)";
const SILVER_FRAME = "linear-gradient(145deg, #a0a0a0 0%, #606060 30%, #404040 70%, #808080 100%)";

type Props = {
  wrestlers: RosterCardWrestler[];
  leagueSlug: string;
  /** User whose roster this is (owner of these cards) */
  teamUserId: string;
  /** Currently logged-in user viewing the page */
  viewerUserId: string;
  /** Show Drop action on cards (only for own team) */
  showDrop?: boolean;
  /** Show Trade action on cards */
  showTrade?: boolean;
  /** Whether this page is the viewer's own team */
  isOwnTeam?: boolean;
};

function WrestlerCard({
  w,
  leagueSlug,
  canDrop,
  canTrade,
  onDropClick,
  onTradeClick,
}: {
  w: RosterCardWrestler;
  leagueSlug: string;
  canDrop: boolean;
  canTrade: boolean;
  onDropClick?: () => void;
  onTradeClick?: () => void;
}) {
  const rating = w.rating_2k26 ?? w.rating_2k25 ?? null;
  const ppm = w.mw > 0 ? w.totalPoints / w.mw : 0;
  const profileHref = `/wrestlers/${encodeURIComponent(w.id)}?league=${encodeURIComponent(leagueSlug)}&from=team`;
  const fullImageUrl = getWrestlerFullImageUrl(w.id);
  const displayName = (w.name || w.id).toUpperCase();
  const brandLower = (w.brand ?? "").toLowerCase().trim();
  const isRaw = brandLower === "raw";
  const isSmackDown = brandLower === "smackdown" || brandLower === "sd";
  const hasBrand = isRaw || isSmackDown;
  const outlineColor = isRaw ? RAW_OUTLINE : isSmackDown ? SMACKDOWN_OUTLINE : "#333";
  const totalPointsBg = isRaw ? RAW_GRADIENT : isSmackDown ? SMACKDOWN_GRADIENT : undefined;
  const isChampion = Boolean(w.championBeltImageUrl);
  const imageFrameBg = isChampion ? GOLD_FRAME : SILVER_FRAME;
  const cardOutline = hasBrand ? `0 4px 20px rgba(0,0,0,0.2), 0 0 0 2px ${outlineColor}` : "0 4px 20px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.08)";

  return (
    <Link
      href={profileHref}
      className="roster-card-link"
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: cardOutline,
        background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      {/* Top bar: WWE 2K logo + rating + chrome accent */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          background: "#0d0d0d",
          borderBottom: "2px solid #c00",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <img
            src="https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/event-logos/wwe-2k.webp"
            alt="WWE 2K"
            loading="lazy"
            style={{
              display: "block",
              height: 52,
              width: "auto",
            }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#c00",
            }}
          >
            {rating != null ? rating : "—"}
          </span>
        </div>
        {canDrop || canTrade ? (
          <div
            style={{
              display: "flex",
              gap: 6,
            }}
          >
            {canTrade && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTradeClick?.();
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 999,
                  border: "1px solid #1a73e8",
                  background: "linear-gradient(135deg, #1a73e8 0%, #0c4ba4 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Trade
              </button>
            )}
            {canDrop && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDropClick?.();
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 999,
                  border: "1px solid #b3261e",
                  background: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Drop
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              width: 28,
              height: 20,
              background: "linear-gradient(135deg, #c0c0c0 0%, #808080 50%, #e8e8e8 100%)",
              borderRadius: 4,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3)",
            }}
            aria-hidden
          />
        )}
      </div>

      {/* Image area with metallic frame */}
      <div
        style={{
          position: "relative",
          padding: "10px 12px 8px",
          background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
        }}
      >
        <div
          style={{
            position: "relative",
            borderRadius: 6,
            overflow: "hidden",
            background: imageFrameBg,
            padding: 6,
            boxShadow: isChampion
              ? "inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)"
              : "inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 220,
              background: "#1a1a1a",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <img
              src={fullImageUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src && !target.dataset.fallback) {
                  target.dataset.fallback = "1";
                  const fallback = (target as HTMLImageElement).getAttribute("data-fallback-src");
                  if (fallback) target.src = fallback;
                  else target.style.display = "none";
                }
              }}
              data-fallback-src={w.image_url || undefined}
            />
            {w.championBeltImageUrl && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "75%",
                  maxWidth: 140,
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              >
                <img
                  src={w.championBeltImageUrl}
                  alt=""
                  aria-hidden
                  style={{ width: "100%", height: "auto", display: "block", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name banner: black with red stripe (WWE-style) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px 8px",
          background: "#0d0d0d",
          borderTop: "2px solid #c00",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: "6px 10px",
            background: "#1a1a1a",
            borderLeft: "3px solid #c00",
            borderRight: "2px solid #333",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 0,
          borderTop: "1px solid #333",
          background: "#f0f2f5",
        }}
      >
        <div style={{ padding: "8px 6px", textAlign: "center", borderRight: "1px solid #ddd", borderBottom: "1px solid #ddd" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#555", marginBottom: 2 }}>R/S</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{w.rsPoints}</div>
        </div>
        <div style={{ padding: "8px 6px", textAlign: "center", borderRight: "1px solid #ddd", borderBottom: "1px solid #ddd" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#555", marginBottom: 2 }}>PLE</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{w.plePoints}</div>
        </div>
        <div style={{ padding: "8px 6px", textAlign: "center", borderRight: "1px solid #ddd", borderBottom: "1px solid #ddd" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#555", marginBottom: 2 }}>BELT</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{w.beltPoints}</div>
        </div>
        <div style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid #ddd" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#555", marginBottom: 2 }}>PPM</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{ppm > 0 ? ppm.toFixed(1) : "—"}</div>
        </div>
      </div>
      <div
        style={{
          padding: "10px 12px",
          background: hasBrand ? totalPointsBg : "#1a1a1a",
          borderTop: hasBrand ? `2px solid ${outlineColor}` : "2px solid #333",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: hasBrand ? "rgba(255,255,255,0.9)" : "#999", marginBottom: 4 }}>TOTAL POINTS</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{w.totalPoints}</div>
      </div>
    </Link>
  );
}

function getSortValue(w: RosterCardWrestler, key: SortKey): number {
  switch (key) {
    case "2k":
      return w.rating_2k26 ?? w.rating_2k25 ?? 0;
    case "rs":
      return w.rsPoints;
    case "ple":
      return w.plePoints;
    case "belt":
      return w.beltPoints;
    case "ppm":
      return w.mw > 0 ? w.totalPoints / w.mw : 0;
    case "total":
      return w.totalPoints;
    default:
      return 0;
  }
}

export function RosterCardGrid({
  wrestlers,
  leagueSlug,
  teamUserId,
  viewerUserId,
  showDrop = false,
  showTrade = false,
  isOwnTeam = false,
}: Props) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortKey>("total");
  const [sortDesc, setSortDesc] = useState(true);

  const sortedWrestlers = useMemo(() => {
    const list = [...wrestlers];
    list.sort((a, b) => {
      const va = getSortValue(a, sortBy);
      const vb = getSortValue(b, sortBy);
      if (va !== vb) return sortDesc ? vb - va : va - vb;
      return (a.name ?? a.id).localeCompare(b.name ?? b.id);
    });
    return list;
  }, [wrestlers, sortBy, sortDesc]);

  function handleDrop(w: RosterCardWrestler) {
    if (!showDrop) return;
    const name = w.name ?? w.id;
    if (typeof window !== "undefined") {
      // Simple confirmation before routing to the release section
      const ok = window.confirm(`Request to drop ${name} from your roster? This will open the release form.`);
      if (!ok) return;
    }
    const url = `/leagues/${encodeURIComponent(leagueSlug)}/team/${encodeURIComponent(
      teamUserId,
    )}?dropWrestlerId=${encodeURIComponent(w.id)}#request-release`;
    router.push(url);
  }

  function handleTrade(w: RosterCardWrestler) {
    if (!showTrade) return;
    // For own team, just open the trade section on my team page.
    // For other teams, go to my team page with proposeTradeTo set to this roster's owner.
    const baseTeamUserId = encodeURIComponent(viewerUserId);
    const base = `/leagues/${encodeURIComponent(leagueSlug)}/team/${baseTeamUserId}`;
    const url = isOwnTeam
      ? `${base}#propose-trade`
      : `${base}?proposeTradeTo=${encodeURIComponent(teamUserId)}#propose-trade`;
    router.push(url);
  }

  return (
    <>
      <style>{`
        a.roster-card-link:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08);
        }
      `}</style>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 14, color: "#666", fontWeight: 600 }}>
          Sort by:
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={{
            padding: "6px 10px",
            fontSize: 14,
            borderRadius: 6,
            border: "1px solid #444",
            background: "#1a1a1a",
            color: "#fff",
            minWidth: 140,
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSortDesc((d) => !d)}
          style={{
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: "1px solid #444",
            background: "#2a2a2a",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {sortDesc ? "High → Low" : "Low → High"}
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 24,
        }}
      >
        {sortedWrestlers.map((w) => (
          <WrestlerCard
            key={w.id}
            w={w}
            leagueSlug={leagueSlug}
            canDrop={showDrop}
            canTrade={showTrade}
            onDropClick={() => handleDrop(w)}
            onTradeClick={() => handleTrade(w)}
          />
        ))}
      </div>
    </>
  );
}
