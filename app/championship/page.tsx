import Link from "next/link";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import { comparePwbsChampionshipSlugs } from "@/lib/pwbsChampionshipSlug.js";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import styles from "./ChampionshipPages.module.css";

export const revalidate = 60;

export const metadata = {
  title: "Championships — Draftastic Fantasy",
  description:
    "WWE championships we track. Title history data is still being expanded and may be incomplete.",
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
        We are still in the process of building out the historical data. Title histories are not complete and may be
        missing data.
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
