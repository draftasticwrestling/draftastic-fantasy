import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/app/internal-admin/internal-admin.module.css";
import { buildTagTeamDataForVisualBuilder, fetchWrestlersForBoxscoreEditor } from "@/lib/boxscoreAdmin/boxscoreEditorData";
import { loadBoxscoreEventForEditor } from "@/lib/boxscoreAdmin/boxscoreEventEditorLoad";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import { EditBoxscoreEventForm } from "./EditBoxscoreEventForm";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return { title: `Edit event — ${decodeURIComponent(eventId)}` };
}

export default async function BoxscoreEditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { eventId: raw } = await params;
  const param = decodeURIComponent(raw);
  const sp = searchParams ? await searchParams : {};
  const admin = getServiceRoleClient();

  if (!admin) {
    return (
      <div>
        <p>
          <Link href="/internal-admin/boxscore/events" className="app-link">
            ← Boxscore events
          </Link>
        </p>
        <p style={{ color: "var(--color-red)" }}>Service role key is not configured.</p>
      </div>
    );
  }

  const event = await loadBoxscoreEventForEditor(admin, param);
  if (!event) notFound();

  const [wrestlers, initialTagTeamData] = await Promise.all([
    fetchWrestlersForBoxscoreEditor(),
    buildTagTeamDataForVisualBuilder(),
  ]);

  return (
    <div style={{ maxWidth: 760 }}>
      {sp.saved === "1" ? (
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
          Changes saved.
        </p>
      ) : null}
      <h1 className={styles.pageTitle}>Edit boxscore event</h1>
      <p className={styles.intro} style={{ marginBottom: 20 }}>
        Updates the shared <code>events</code> row (PWBS field allowlist). Live match commentary still writes through the server while you edit.
      </p>
      {wrestlers.length === 0 ? (
        <p style={{ color: "var(--color-red)", marginBottom: 16, fontSize: 14 }}>
          No wrestlers loaded — check <code>SUPABASE_SERVICE_ROLE_KEY</code>. The match editor needs a roster.
        </p>
      ) : null}
      <EditBoxscoreEventForm event={event} wrestlers={wrestlers} initialTagTeamData={initialTagTeamData} />
    </div>
  );
}
