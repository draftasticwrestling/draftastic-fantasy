import Link from "next/link";
import styles from "../../internal-admin.module.css";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";
import { sortChampionshipsForPublicDisplay } from "@/lib/championshipAdminDisplay";
import { ChampionshipsManager } from "./ChampionshipsManager";

export const metadata = { title: "Championships — Site admin" };

export default async function BoxscoreChampionshipsPage() {
  await requireSiteAdmin();
  const admin = getAdminClient();
  let championships: unknown[] = [];
  let history: unknown[] = [];
  if (admin) {
    const champRes = await admin
      .from("championships")
      .select(
        "id,title_name,brand,type,current_champion,current_champion_slug,previous_champion,previous_champion_slug,date_won,event_name,title_facts"
      );
    championships = (champRes.data ?? []) as unknown[];

    const historyFull = await admin
      .from("championship_history")
      .select(
        "id,championship_id,champion,champion_slug,previous_champion,previous_champion_slug,date_won,date_lost,event_name,event_lost,days_held,reign_kind"
      )
      .order("date_won", { ascending: false });
    if (historyFull.error && /reign_kind/i.test(historyFull.error.message ?? "")) {
      const historyLegacy = await admin
        .from("championship_history")
        .select(
          "id,championship_id,champion,champion_slug,previous_champion,previous_champion_slug,date_won,date_lost,event_name,event_lost,days_held"
        )
        .order("date_won", { ascending: false });
      history = (historyLegacy.data ?? []) as unknown[];
    } else {
      history = (historyFull.data ?? []) as unknown[];
    }
  }

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Champions &amp; title history</h1>
      <p className={styles.intro}>
        Manage current champions and title history rows from PWBS tables directly in the Draftastic admin panel.
      </p>
      <ChampionshipsManager
        championships={sortChampionshipsForPublicDisplay(championships as { id: string; title_name?: string | null }[]) as never[]}
        history={history as never[]}
      />
    </div>
  );
}
