import Link from "next/link";
import { notFound } from "next/navigation";
import { siteAdminGetEventByParam } from "@/lib/internalAdmin/siteAdminEvents";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import { buildEventResultsSlug, eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import styles from "../../internal-admin.module.css";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return { title: `${decodeURIComponent(eventId)} — Event — Site admin` };
}

export default async function InternalAdminEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ created?: string }>;
}) {
  const { eventId: raw } = await params;
  const sp = searchParams ? await searchParams : {};
  const param = decodeURIComponent(raw);
  const admin = getServiceRoleClient();

  if (!admin) {
    return (
      <div>
        <p>
          <Link href="/internal-admin/events" className="app-link">
            ← Events
          </Link>
        </p>
        <p style={{ color: "var(--color-red)" }}>Service role key is not configured.</p>
      </div>
    );
  }

  const event = await siteAdminGetEventByParam(admin, param);
  if (!event) notFound();

  const matchesJson = JSON.stringify(event.matches ?? [], null, 2);
  const previewRecap = { preview: event.preview, recap: event.recap };

  return (
    <div style={{ maxWidth: 960 }}>
      {sp.created === "1" ? (
        <p
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: "var(--radius-sm)",
            background: "var(--color-blue-bg)",
            border: "1px solid var(--color-border)",
            fontSize: 14,
          }}
        >
          Event created.{" "}
          <Link href="/internal-admin/boxscore/events/new" className="app-link">
            Add another
          </Link>
        </p>
      ) : null}
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/events" className="app-link">
          ← Events
        </Link>
        {" · "}
        <Link href={eventResultsHref(event)} className="app-link" target="_blank" rel="noopener noreferrer">
          View on site
        </Link>
        {" · "}
        <Link
          href={`/internal-admin/boxscore/events/${encodeURIComponent(buildEventResultsSlug(event))}/edit`}
          className="app-link"
        >
          Edit in boxscore
        </Link>
      </p>

      <h1 className={styles.pageTitle}>{event.name ?? "Event"}</h1>
      <p style={{ fontFamily: "monospace", fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
        id <strong>{event.id}</strong>
      </p>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "160px 1fr",
          gap: "8px 16px",
          fontSize: 14,
          marginBottom: 24,
        }}
      >
        <dt style={{ color: "var(--color-text-muted)" }}>Date</dt>
        <dd style={{ margin: 0 }}>{event.date ?? "—"}</dd>
        <dt style={{ color: "var(--color-text-muted)" }}>Location</dt>
        <dd style={{ margin: 0 }}>{event.location ?? "—"}</dd>
        <dt style={{ color: "var(--color-text-muted)" }}>Status</dt>
        <dd style={{ margin: 0 }}>{event.status ?? "—"}</dd>
        <dt style={{ color: "var(--color-text-muted)" }}>Broadcast start</dt>
        <dd style={{ margin: 0 }}>{event.broadcast_start_ts ?? "—"}</dd>
      </dl>

      <h2 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Preview / recap (raw fields)</h2>
      <pre
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          padding: 14,
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "auto",
          maxHeight: 200,
        }}
      >
        {JSON.stringify(previewRecap, null, 2)}
      </pre>

      <h2 style={{ fontSize: "1.05rem", margin: "24px 0 8px" }}>matches (JSON)</h2>
      <pre
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          padding: 14,
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "auto",
          maxHeight: "min(70vh, 720px)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {matchesJson}
      </pre>
    </div>
  );
}
