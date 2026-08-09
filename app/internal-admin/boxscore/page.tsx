import Link from "next/link";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Wrestlers — Site admin",
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
    desc: "Add and edit tag teams, members, and stable assignments.",
  },
] as const;

export default function WrestlersAdminHubPage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Wrestlers</h1>
      <p className={styles.intro} style={{ maxWidth: 720 }}>
        Roster tools used by results pages and fantasy scoring (same Supabase as{" "}
        <a href="https://prowrestlingboxscore.com" target="_blank" rel="noopener noreferrer" className="app-link">
          prowrestlingboxscore.com
        </a>
        ).
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
