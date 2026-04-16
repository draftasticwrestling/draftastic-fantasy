import Link from "next/link";
import styles from "../../internal-admin.module.css";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";
import { TagTeamsStablesManager } from "./TagTeamsStablesManager";

export const metadata = { title: "Tag teams & stables — Site admin" };

export default async function BoxscoreTagTeamsStablesPage() {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const [{ data: teams }, { data: members }, { data: wrestlers }] = admin
    ? await Promise.all([
        admin
          .from("tag_teams")
          .select("id,name,brand,description,is_stable,primary_for_stable,active")
          .order("name", { ascending: true }),
        admin
          .from("tag_team_members")
          .select("tag_team_id,wrestler_slug,member_order,active")
          .order("member_order", { ascending: true }),
        admin
          .from("wrestlers")
          .select("id,name,stable,is_stable_leader")
          .order("name", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Tag teams &amp; stables</h1>
      <p className={styles.intro}>
        Manage tag teams, members, and stable assignments in one place. This ports PWBS team/stable admin workflows into
        the internal admin panel.
      </p>
      <TagTeamsStablesManager
        teams={(teams ?? []) as never[]}
        members={(members ?? []) as never[]}
        wrestlers={(wrestlers ?? []) as never[]}
      />
    </div>
  );
}
