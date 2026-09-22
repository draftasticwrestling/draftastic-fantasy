import styles from "../../internal-admin.module.css";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";
import { sortChampionshipsForPublicDisplay } from "@/lib/championshipAdminDisplay";
import { isChampionshipRetiredAsOf } from "@/lib/retiredChampionships.js";
import { ChampionshipsManager } from "./ChampionshipsManager";

export const metadata = { title: "Championships — Site admin" };

type ChampRow = {
  id: string;
  title_name?: string | null;
  brand?: string | null;
  type?: string | null;
  current_champion?: string | null;
  current_champion_slug?: string | null;
  previous_champion?: string | null;
  previous_champion_slug?: string | null;
  date_won?: string | null;
  event_name?: string | null;
  title_facts?: string | null;
};

function isRetiredChampRow(row: ChampRow): boolean {
  return isChampionshipRetiredAsOf(row.id) || isChampionshipRetiredAsOf(row.title_name);
}

export default async function BoxscoreChampionshipsPage() {
  await requireSiteAdmin();
  const admin = getAdminClient();
  let championships: ChampRow[] = [];
  let history: unknown[] = [];
  if (admin) {
    const champRes = await admin
      .from("championships")
      .select(
        "id,title_name,brand,type,current_champion,current_champion_slug,previous_champion,previous_champion_slug,date_won,event_name,title_facts"
      );
    championships = (champRes.data ?? []) as ChampRow[];

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

  const active = sortChampionshipsForPublicDisplay(championships.filter((c) => !isRetiredChampRow(c)));
  const retired = sortChampionshipsForPublicDisplay(championships.filter((c) => isRetiredChampRow(c)));

  return (
    <div>
      <h1 className={styles.pageTitle}>Champions &amp; title history</h1>
      <p className={styles.intro}>
        Manage current champions and title history rows from PWBS tables directly in the Draftastic admin panel.
        Retired titles (e.g. NXT Speed) stay out of the active list; open one below only if you need to edit past
        reigns.
      </p>
      <ChampionshipsManager
        championships={active as never[]}
        retiredChampionships={retired as never[]}
        history={history as never[]}
      />
    </div>
  );
}
