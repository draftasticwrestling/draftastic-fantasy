import Link from "next/link";
import styles from "../internal-admin.module.css";

export function PlaceholderSection({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>{title}</h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 640, lineHeight: 1.55 }}>{summary}</p>
      <p
        style={{
          marginTop: 24,
          padding: 14,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          fontSize: 14,
        }}
      >
        <strong>Not built yet.</strong> Next step: map PWBS forms to this route, reuse validation and Supabase writes, and
        add <code>admin_audit_log</code> entries for mutations.
      </p>
    </div>
  );
}
