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
          <Link href="/internal-admin/nudges" className={styles.cardLink}>
            <span className={styles.cardTitle}>Login nudges</span>
            <span className={styles.cardDesc}>
              Configure post-login popup reminders for user onboarding and in-season prompts.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/engagement" className={styles.cardLink}>
            <span className={styles.cardTitle}>Season engagement</span>
            <span className={styles.cardDesc}>
              Sign-ins, roster moves, trade activity, logged-in sessions, and key page-visit trends.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/weekly-leaderboards" className={styles.cardLink}>
            <span className={styles.cardTitle}>Weekly leaderboards & XP</span>
            <span className={styles.cardDesc}>
              Snapshot coverage, weekly-high and per-50 XP ledger tail, SQL verification pack, and league home Top 10 preview.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/boxscore/events" className={styles.cardLink}>
            <span className={styles.cardTitle}>Events & match card</span>
            <span className={styles.cardDesc}>
              Edit shows, matches, and promos (PWBS workflow). Use the Events tab in the admin bar or start here.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/boxscore" className={styles.cardLink}>
            <span className={styles.cardTitle}>Wrestlers</span>
            <span className={styles.cardDesc}>
              Wrestlers, tag teams, stables, and related roster tools used by results and fantasy scoring.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/boxscore/championships" className={styles.cardLink}>
            <span className={styles.cardTitle}>Championships</span>
            <span className={styles.cardDesc}>Current champions and championship history edits.</span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/boxscore/options" className={styles.cardLink}>
            <span className={styles.cardTitle}>Dropdown options</span>
            <span className={styles.cardDesc}>
              Event type, stipulation, and special match winner labels (merged with built-in lists).
            </span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/events" className={styles.cardLink}>
            <span className={styles.cardTitle}>Events JSON inspector</span>
            <span className={styles.cardDesc}>Read-only search and raw matches JSON (debugging).</span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/stat-corrections" className={styles.cardLink}>
            <span className={styles.cardTitle}>Stat corrections</span>
            <span className={styles.cardDesc}>Publish notices shown on league Stat corrections tabs; writes audit log.</span>
          </Link>
        </li>
        <li>
          <Link href="/internal-admin/breaking-news" className={styles.cardLink}>
            <span className={styles.cardTitle}>Breaking news</span>
            <span className={styles.cardDesc}>
              Homepage chyron below the hero banner — schedule announcements with optional links.
            </span>
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
