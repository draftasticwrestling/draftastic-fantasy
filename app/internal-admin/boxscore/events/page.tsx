import Link from "next/link";
import styles from "../../internal-admin.module.css";
import { JumpToBoxscoreEventEditor } from "./JumpToBoxscoreEventEditor";

export const metadata = { title: "Events (Boxscore) — Site admin" };

export default function BoxscoreEventsEditorPage() {
  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Events, matches &amp; promos</h1>
      <p className={styles.intro}>
        Editors for the shared PWBS <code>events</code> table. The read-only inspector lives under{" "}
        <Link href="/internal-admin/events" className="app-link">
          /internal-admin/events
        </Link>
        .
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "24px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <li>
          <Link href="/internal-admin/boxscore/events/new" className={styles.cardLink}>
            <span className={styles.cardTitle}>Add event</span>
            <span className={styles.cardDesc}>
              Create a new event with the visual match builder and MatchEdit modals (PWBS-shaped payloads).
            </span>
          </Link>
        </li>
        <li
          className={styles.cardLink}
          style={{ display: "block", cursor: "default", textDecoration: "none", color: "inherit" }}
        >
          <span className={styles.cardTitle}>Edit an existing event</span>
          <span className={styles.cardDesc} style={{ display: "block" }}>
            Use the full editor at{" "}
            <code style={{ fontSize: 12 }}>/internal-admin/boxscore/events/[eventId]/edit</code>. Easiest path: open an event in
            the inspector and click <strong>Edit in boxscore</strong>.
          </span>
          <p style={{ margin: "12px 0 0", fontSize: 14 }}>
            <Link href="/internal-admin/events" className="app-link">
              Open Events inspector →
            </Link>
          </p>
          <JumpToBoxscoreEventEditor />
        </li>
      </ul>
      <p
        style={{
          marginTop: 28,
          padding: 14,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          fontSize: 14,
          color: "var(--color-text-muted)",
          maxWidth: 640,
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "var(--color-text)" }}>Still to port from PWBS:</strong> dedicated live-results hub, delete event,
        wrestler/championship admin under Boxscore.
      </p>
    </div>
  );
}
