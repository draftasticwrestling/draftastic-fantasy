import Link from "next/link";
import styles from "@/app/internal-admin/internal-admin.module.css";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import type { BoxscoreUiOptionCategory } from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
import { BoxscoreOptionsManager } from "./BoxscoreOptionsManager";

export const metadata = { title: "Boxscore dropdown options — Site admin" };

export default async function BoxscoreOptionsPage() {
  const admin = getServiceRoleClient();
  let rows: { id: string; label: string; sort_order: number; category: BoxscoreUiOptionCategory }[] = [];
  if (admin) {
    const { data, error } = await admin
      .from("boxscore_ui_options")
      .select("id, label, sort_order, category")
      .order("category")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data) {
      rows = data as typeof rows;
    }
  }

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Boxscore dropdown options</h1>
      <p className={styles.intro} style={{ maxWidth: 720, marginBottom: 24 }}>
        Add labels for <strong>Event type</strong>, <strong>Stipulations</strong>, and <strong>Special match winner</strong> without
        deploying code. Custom entries are merged with the built-in lists used in add/edit event and MatchEdit.
      </p>
      {!admin ? (
        <p style={{ color: "var(--color-red)" }}>Service role key is not configured — cannot load or edit options.</p>
      ) : (
        <BoxscoreOptionsManager rows={rows} />
      )}
    </div>
  );
}
