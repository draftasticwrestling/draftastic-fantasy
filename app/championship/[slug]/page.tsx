import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import { titleToChampionshipSlug } from "@/lib/championshipPathSlug";
import { getPwbsDisplayTitleForSlug } from "@/lib/pwbsChampionshipSlug.js";
import { displayChampionshipDate, reignLengthDays } from "@/lib/championshipTitleHistory";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import { collapseTagTeamChampionsForCard } from "@/lib/championshipCardTagChampions";
import styles from "../ChampionshipPages.module.css";

export const dynamic = "force-dynamic";

const BOXSORE_CHAMPIONSHIP_BASE = "https://prowrestlingboxscore.com/championship";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const data = await getChampionshipHistoryDataset();
  const bucket = data.titleHistoryBySlug.get(slug);
  const title =
    bucket?.displayTitle ?? getPwbsDisplayTitleForSlug(slug) ?? titleToChampionshipSlug(slug);
  if (!bucket?.items.length) {
    return { title: "Championship — Draftastic Fantasy" };
  }
  return {
    title: `${title} — Championship history — Draftastic Fantasy`,
    description: `Title history and current champion for the ${title}. Data from Pro Wrestling Boxscore.`,
    alternates: {
      canonical: `/championship/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function ChampionshipDetailPage({ params }: Props) {
  const { slug } = await params;
  const data = await getChampionshipHistoryDataset();
  const bucket = data.titleHistoryBySlug.get(slug);
  if (!bucket?.items.length) notFound();

  const title = bucket.displayTitle;
  const items = [...bucket.items].sort((a, b) => b.wonDate.localeCompare(a.wonDate));
  if (items.length === 0) notFound();

  const latestWon = items[0].wonDate;
  const rawCurrent = items.filter((x) => x.wonDate === latestWon);
  const { champions: currentChamps, tagTeamName, hasTeamNameRow } = collapseTagTeamChampionsForCard(
    title,
    rawCurrent,
    {
      wrestlerBySlug: data.wrestlerBySlug,
      wrestlerByNameKey: data.wrestlerByNameKey,
      tagTeamMonikerByMemberKey: data.tagTeamMonikerByMemberKey,
    }
  );

  const beltImageUrl = getBeltImageUrlForTitle(title);
  const boxscoreUrl = `${BOXSORE_CHAMPIONSHIP_BASE}/${encodeURIComponent(slug)}`;

  const current = items[0];
  const wonSubtitle =
    current.eventWon != null && String(current.eventWon).trim() !== ""
      ? `Won ${displayChampionshipDate(current.wonDate)} at ${current.eventWon}`
      : `Won ${displayChampionshipDate(current.wonDate)}`;

  const rowsNewestFirst = items.map((h) => ({
    ...h,
    days: reignLengthDays(h.wonDate, h.lostDate),
  }));

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/wrestlers">Wrestlers</Link>
        {" · "}
        <Link href="/championship">Championships</Link>
      </nav>

      <article className={styles.hero}>
        <h1 className={styles.title}>{title}</h1>
        {beltImageUrl && (
          <Image
            src={beltImageUrl}
            alt=""
            width={280}
            height={72}
            sizes="(max-width: 640px) 90vw, 280px"
            className={styles.belt}
          />
        )}
        <div className={styles.currentBlock}>
          <p className={styles.currentLabel}>Current champion{currentChamps.length > 1 ? "s" : ""}</p>
          <div className={styles.avatarRow}>
            {currentChamps.map((c) => (
              <div key={`${c.championSlug}-${c.champion}`}>
                {c.imageUrl ? (
                  <Image
                    src={c.imageUrl}
                    alt=""
                    width={56}
                    height={56}
                    sizes="56px"
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder} aria-hidden>
                    ?
                  </div>
                )}
              </div>
            ))}
          </div>
          {hasTeamNameRow ? (
            <p
              className={
                tagTeamName
                  ? styles.championTeamName
                  : `${styles.championTeamName} ${styles.championTeamNameEmpty}`
              }
            >
              {tagTeamName ?? "\u00a0"}
            </p>
          ) : null}
          <p className={styles.championNames}>{currentChamps.map((c) => c.champion).join(" & ")}</p>
          <p className={styles.currentWonMeta}>{wonSubtitle}</p>
        </div>
      </article>

      <h2 className={styles.sectionTitle}>Title history</h2>
      <p className={styles.sectionCaption}>Most recent champion at top; chronological order by date won.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Champion</th>
              <th scope="col">Defeated</th>
              <th scope="col">Date won</th>
              <th scope="col">Event won</th>
              <th scope="col">Date lost</th>
              <th scope="col">Event lost</th>
              <th scope="col">Days</th>
            </tr>
          </thead>
          <tbody>
            {rowsNewestFirst.map((h) => {
              const profileSlug = data.wrestlerBySlug.has(h.championSlug) ? h.championSlug : null;
              const defeatedSlug =
                h.defeatedSlug && data.wrestlerBySlug.has(h.defeatedSlug) ? h.defeatedSlug : null;
              const daysDisplay =
                h.lostDate == null
                  ? "—"
                  : h.daysHeldDb != null
                    ? String(h.daysHeldDb)
                    : h.days != null
                      ? String(h.days)
                      : "—";
              return (
                <tr key={`${h.championSlug}-${h.wonDate}-${h.lostDate ?? "present"}`}>
                  <td>
                    <div className={styles.cellChampion}>
                      {h.imageUrl ? (
                        <Image
                          src={h.imageUrl}
                          alt=""
                          width={36}
                          height={36}
                          sizes="36px"
                          className={styles.cellThumb}
                        />
                      ) : (
                        <span className={styles.thumbPh} aria-hidden>
                          ?
                        </span>
                      )}
                      <span>
                        {profileSlug ? (
                          <Link
                            href={`/wrestlers/${encodeURIComponent(profileSlug)}`}
                            style={{ color: "#e8e8e8", fontWeight: 600, textDecoration: "none" }}
                          >
                            {h.champion}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{h.champion}</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    {h.defeated ? (
                      defeatedSlug ? (
                        <Link
                          href={`/wrestlers/${encodeURIComponent(defeatedSlug)}`}
                          className={styles.cellLink}
                        >
                          {h.defeated}
                        </Link>
                      ) : (
                        <span>{h.defeated}</span>
                      )
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>{displayChampionshipDate(h.wonDate)}</td>
                  <td>{h.eventWon ? h.eventWon : <span className={styles.muted}>—</span>}</td>
                  <td>{h.lostDate ? displayChampionshipDate(h.lostDate) : "—"}</td>
                  <td>
                    {h.eventLost ? h.eventLost : <span className={styles.muted}>—</span>}
                  </td>
                  <td className={styles.muted}>{daysDisplay}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.external}>
        Same title on Pro Wrestling Boxscore:{" "}
        <a href={boxscoreUrl} target="_blank" rel="noopener noreferrer">
          {slug}
        </a>
      </p>
    </div>
  );
}
