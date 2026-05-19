import Link from "next/link";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Boxscore admin — Site admin",
};

const SECTIONS = [
  {
    href: "/internal-admin/boxscore/events",
    title: "Events & card",
    desc: "List shows, edit the match card (matches, promos, reorder) — same workflow as PWBS Edit Event.",
  },
  {
    href: "/internal-admin/boxscore/wrestlers",
    title: "Wrestlers",
    desc: "Add and edit wrestlers, profile fields, and image uploads (PWBS parity).",
  },
  {
    href: "/internal-admin/boxscore/tag-teams-stables",
    title: "Tag teams & stables",
    desc: "Add and edit tag teams and stables.",
  },
  {
    href: "/internal-admin/boxscore/championships",
    title: "Champions & title history",
    desc: "Current champions and championship_history-style edits.",
  },
  {
    href: "/internal-admin/boxscore/options",
    title: "Dropdown options",
    desc: "Add Event type, Stipulation, and Special match winner labels (merged with built-in lists).",
  },
] as const;

export default function BoxscoreAdminHubPage() {
  return (
    <div>
      <p style={{ marginBottom: 20 }}>
        <Link href="/internal-admin" className="app-link">
          ← Site admin home
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Boxscore admin (PWBS tools)</h1>
      <p className={styles.intro} style={{ maxWidth: 720 }}>
        Official home for event results and championship history (same Supabase as{" "}
        <a href="https://prowrestlingboxscore.com" target="_blank" rel="noopener noreferrer" className="app-link">
          prowrestlingboxscore.com
        </a>
        ). Admin runbook: <code style={{ fontSize: 13 }}>docs/BOXSCORE_ADMIN_OPS.md</code>. Technical mapping:{" "}
        <code style={{ fontSize: 13 }}>docs/PWBS_ADMIN_SOURCE_MAP.md</code>. Read-only <code>matches</code> JSON:{" "}
        <Link href="/internal-admin/events" className="app-link">
          Events inspector
        </Link>
        .
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className={styles.cardLink}>
              <span className={styles.cardTitle}>{s.title}</span>
              <span className={styles.cardDesc}>{s.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
