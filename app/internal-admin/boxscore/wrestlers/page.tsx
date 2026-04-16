import Link from "next/link";
import styles from "../../internal-admin.module.css";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";
import { WrestlersManager } from "./WrestlersManager";

export const metadata = { title: "Wrestlers (Boxscore) — Site admin" };

export default async function BoxscoreWrestlersAdminPage() {
  await requireSiteAdmin();
  const admin = getAdminClient();
  let wrestlers: Record<string, unknown>[] = [];

  if (admin) {
    // Load a guaranteed-safe base shape first, then hydrate optional columns
    // so one missing column cannot blank out the entire editor list.
    const { data: baseRows } = await admin.from("wrestlers").select("id,name").order("name", { ascending: true });
    const base = (baseRows ?? []).filter(
      (r): r is { id: string; name: string } =>
        typeof r?.id === "string" && r.id.trim() !== "" && typeof r?.name === "string"
    );

    const byId = new Map<string, Record<string, unknown>>();
    for (const row of base) byId.set(row.id, { ...row });

    const ids = base.map((r) => r.id);
    const hydrate = async (columnExpr: string, key: string) => {
      if (ids.length === 0) return;
      const { data } = await (admin.from("wrestlers") as any).select(`id, ${columnExpr}`).in("id", ids);
      for (const row of ((data ?? []) as Record<string, unknown>[])) {
        const id = String((row as { id?: unknown }).id ?? "");
        if (!id || !byId.has(id)) continue;
        const value = row[key];
        if (value !== undefined) byId.get(id)![key] = value;
      }
    };

    await Promise.all([
      hydrate("nickname", "nickname"),
      hydrate("brand", "brand"),
      hydrate("person_type", "person_type"),
      hydrate("dob", "dob"),
      hydrate("nationality", "nationality"),
      hydrate("billed_from", "billed_from"),
      hydrate("height", "height"),
      hydrate("weight", "weight"),
      hydrate("image_url", "image_url"),
      hydrate("full_body_image_url", "full_body_image_url"),
      hydrate("accomplishments", "accomplishments"),
      hydrate("tag_team_name", "tag_team_name"),
      hydrate("tag_team_partner_slug", "tag_team_partner_slug"),
      hydrate("stable", "stable"),
      hydrate("is_stable_leader", "is_stable_leader"),
      // These columns vary by environment/casing in legacy PWBS data.
      hydrate("classification", "classification"),
      hydrate('"Classification"', "Classification"),
      hydrate("status", "status"),
      hydrate('"Status"', "Status"),
    ]);

    wrestlers = Array.from(byId.values()).map((row) => ({
      ...row,
      classification: row.classification ?? row.Classification ?? "Active",
      status: row.status ?? row.Status ?? "",
    }));
  }

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Wrestlers</h1>
      <p className={styles.intro}>
        Manage wrestler records used by results pages and fantasy scoring. This ports the PWBS add/edit workflow into the
        internal admin panel.
      </p>
      <WrestlersManager wrestlers={wrestlers as never[]} />
    </div>
  );
}
