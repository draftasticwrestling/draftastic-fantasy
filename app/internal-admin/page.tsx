import Link from "next/link";
import styles from "./internal-admin.module.css";

export default function InternalAdminHomePage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Site admin</h1>
      <p className={styles.intro}>
        Manage news articles and internal tools. League commissioners use GM tools inside each league; this area is
        for site admins only.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        <li>
          <Link href="/internal-admin/users" className={styles.cardLink}>
            <span className={styles.cardTitle}>Users</span>
            <span className={styles.cardDesc}>
              Read-only directory of registered accounts (email, profile, site-admin flag). Requires service role env on
              the server.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/leagues" className={styles.cardLink}>
            <span className={styles.cardTitle}>Leagues</span>
            <span className={styles.cardDesc}>
              Read-only search and league detail (members, active roster counts). Requires service role env on the
              server.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/events" className={styles.cardLink}>
            <span className={styles.cardTitle}>Events</span>
            <span className={styles.cardDesc}>Inspect boxscore events and raw matches JSON (read-only).</span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/boxscore" className={styles.cardLink}>
            <span className={styles.cardTitle}>Boxscore admin</span>
            <span className={styles.cardDesc}>
              PWBS-style data entry: wrestlers, tag teams, titles, events/matches/promos, live results (stubs — forms
              next).
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/stat-corrections" className={styles.cardLink}>
            <span className={styles.cardTitle}>Stat corrections</span>
            <span className={styles.cardDesc}>Publish notices shown on league Stat corrections tabs; writes audit log.</span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/articles" className={styles.cardLink}>
            <span className={styles.cardTitle}>Articles / blog</span>
            <span className={styles.cardDesc}>Draft, publish, and edit Markdown posts for /news.</span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/draft-testing" className={styles.cardLink}>
            <span className={styles.cardTitle}>Draft testing</span>
            <span className={styles.cardDesc}>Legacy draft flow experiments.</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
