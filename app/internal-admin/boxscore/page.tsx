import Link from "next/link";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Boxscore admin — Site admin",
};

const SECTIONS = [
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
    href: "/internal-admin/boxscore/events",
    title: "Events & card",
    desc: "Add and edit events (completed and upcoming), matches, and promos.",
  },
  {
    href: "/internal-admin/boxscore/live-results",
    title: "Live results",
    desc: "Update live / in-progress show results.",
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
        Port of Pro Wrestling Boxscore data-entry workflows into this portal. PWBS repo:{" "}
        <code style={{ fontSize: 13 }}>/Users/thisguytoph/wrestling-boxscore</code>. File/route mapping lives in{" "}
        <code style={{ fontSize: 13 }}>docs/PWBS_ADMIN_SOURCE_MAP.md</code>. Same Supabase tables and storage as PWBS;
        Draftastic uses <code>is_site_admin</code> and server-side writes (service role + audit), unlike PWBS (any logged-in
        user can edit). Read-only JSON inspection stays under{" "}
        <Link href="/internal-admin/events" className="app-link">
          Events
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
