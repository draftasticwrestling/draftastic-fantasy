import Link from "next/link";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import { comparePwbsChampionshipSlugs } from "@/lib/pwbsChampionshipSlug.js";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import styles from "./ChampionshipPages.module.css";

export const revalidate = 60;

export const metadata = {
  title: "Championships — Draftastic Fantasy",
  description:
    "WWE championship titles and full title history from Pro Wrestling Boxscore. Open any belt for reigns, dates, and current champions.",
};

export default async function ChampionshipsIndexPage() {
  const data = await getChampionshipHistoryDataset();
  const cards = [...data.titleHistoryBySlug.entries()]
    .map(([slug, bucket]) => ({ slug, displayTitle: bucket.displayTitle }))
    .sort((a, b) => comparePwbsChampionshipSlugs(a.slug, b.slug));

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/wrestlers">Wrestlers</Link>
      </nav>

      <h1 className={styles.pageTitle}>CHAMPIONSHIPS</h1>
      <p className={styles.pageSubtitle}>
        Full title history for each WWE championship we track. Matches the structure of{" "}
        <a
          href="https://prowrestlingboxscore.com/championships"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-blue)" }}
        >
          Pro Wrestling Boxscore championships
        </a>
        — select a belt for reigns, dates, and days held.
      </p>

      <div className={styles.indexGrid}>
        {cards.map(({ slug, displayTitle }) => {
          const belt = getBeltImageUrlForTitle(displayTitle);
          return (
            <Link key={slug} href={`/championship/${encodeURIComponent(slug)}`} className={styles.indexCard}>
              <h2 className={styles.indexCardTitle}>{displayTitle}</h2>
              <div className={styles.indexCardBelt} aria-hidden={!belt}>
                {belt ? <img src={belt} alt="" /> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
