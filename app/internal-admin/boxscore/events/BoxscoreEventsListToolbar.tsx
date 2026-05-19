import Link from "next/link";
import {
  buildBoxscoreEventsListHref,
  nextSiteAdminEventsLimit,
  SITE_ADMIN_EVENTS_DEFAULT_LIMIT,
  SITE_ADMIN_EVENTS_DEFAULT_STATUS,
  SITE_ADMIN_EVENTS_LIMIT_OPTIONS,
  type SiteAdminEventShowFilter,
  type SiteAdminEventStatusFilter,
  type SiteAdminEventsLimit,
} from "@/lib/internalAdmin/boxscoreEventsListParams";

const pillBase: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: "var(--radius-sm)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  border: "1px solid var(--color-border)",
};

function pill(active: boolean): React.CSSProperties {
  return {
    ...pillBase,
    background: active ? "var(--color-blue)" : "var(--color-bg-surface)",
    color: active ? "#fff" : "var(--color-text)",
    borderColor: active ? "var(--color-blue)" : "var(--color-border)",
  };
}

type ToolbarProps = {
  status: SiteAdminEventStatusFilter;
  show: SiteAdminEventShowFilter;
  limit: SiteAdminEventsLimit;
  q: string;
  date: string;
  id: string;
  rowCount: number;
  hasMore: boolean;
};

const STATUS_OPTIONS: { value: SiteAdminEventStatusFilter; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "all", label: "All statuses" },
];

const SHOW_OPTIONS: { value: SiteAdminEventShowFilter; label: string }[] = [
  { value: "all", label: "All shows" },
  { value: "raw", label: "RAW" },
  { value: "smackdown", label: "SmackDown" },
  { value: "nxt", label: "NXT" },
  { value: "ple", label: "PLEs" },
];

export function BoxscoreEventsListToolbar({
  status,
  show,
  limit,
  q,
  date,
  id,
  rowCount,
  hasMore,
}: ToolbarProps) {
  const base = { q, date, id, limit };
  const nextLimit = nextSiteAdminEventsLimit(limit);
  const hasActiveFilters =
    status !== SITE_ADMIN_EVENTS_DEFAULT_STATUS ||
    show !== "all" ||
    limit !== SITE_ADMIN_EVENTS_DEFAULT_LIMIT ||
    Boolean(q || date || id);

  return (
    <div style={{ marginBottom: 20, maxWidth: 900 }}>
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-text-muted)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Status
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {STATUS_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={buildBoxscoreEventsListHref({ ...base, status: opt.value, show })}
              style={pill(status === opt.value)}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-text-muted)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Show type
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SHOW_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={buildBoxscoreEventsListHref({ ...base, status, show: opt.value })}
              style={pill(show === opt.value)}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Showing <strong style={{ color: "var(--color-text)" }}>{rowCount}</strong>
          {hasMore ? "+" : ""} event{rowCount === 1 ? "" : "s"}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>List up to</span>
          {SITE_ADMIN_EVENTS_LIMIT_OPTIONS.map((n) => (
            <Link
              key={n}
              href={buildBoxscoreEventsListHref({ ...base, status, show, limit: n })}
              style={pill(limit === n)}
            >
              {n}
            </Link>
          ))}
        </div>
        {hasMore && nextLimit ? (
          <Link
            href={buildBoxscoreEventsListHref({ ...base, status, show, limit: nextLimit })}
            className="app-link"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            Load more ({nextLimit} events) →
          </Link>
        ) : null}
        {hasActiveFilters ? (
          <Link href="/internal-admin/boxscore/events" className="app-link" style={{ fontSize: 14 }}>
            Reset filters
          </Link>
        ) : null}
      </div>
    </div>
  );
}
