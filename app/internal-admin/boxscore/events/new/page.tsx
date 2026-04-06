import Link from "next/link";
import styles from "@/app/internal-admin/internal-admin.module.css";
import { getMergedBoxscoreUiOptions } from "@/lib/boxscoreAdmin/boxscoreUiOptions";
import { buildTagTeamDataForVisualBuilder, fetchWrestlersForBoxscoreEditor } from "@/lib/boxscoreAdmin/boxscoreEditorData";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import { AddBoxscoreEventForm } from "./AddBoxscoreEventForm";

export const metadata = { title: "Add event (Boxscore) — Site admin" };

export default async function BoxscoreAddEventPage() {
  const admin = getServiceRoleClient();
  const [wrestlers, initialTagTeamData, mergedOptions] = await Promise.all([
    fetchWrestlersForBoxscoreEditor(),
    buildTagTeamDataForVisualBuilder(),
    getMergedBoxscoreUiOptions(admin),
  ]);

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore/events" className="app-link">
          ← Boxscore events
        </Link>
        {" · "}
        <Link href="/internal-admin/events" className="app-link">
          Events inspector
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Add boxscore event</h1>
      <p className={styles.intro}>
        Creates a row in <code>events</code> with the same field allowlist as PWBS. The <strong>visual match builder</strong> and{" "}
        <strong>MatchEdit</strong> flows are ported from Pro Wrestling Boxscore. Use <strong>Upcoming</strong> for an empty card; completed or live
        events need at least one valid match (same rules as PWBS).
      </p>
      <p className={styles.intro} style={{ marginTop: -12 }}>
        <strong>Editing an event that already exists?</strong> Open it in the{" "}
        <Link href="/internal-admin/events" className="app-link">
          Events inspector
        </Link>{" "}
        and choose <strong>Edit in boxscore</strong>, or open{" "}
        <code style={{ fontSize: 13 }}>/internal-admin/boxscore/events/[id-or-slug]/edit</code>.
      </p>
      {wrestlers.length === 0 ? (
        <p style={{ color: "var(--color-red)", marginBottom: 20, fontSize: 14 }}>
          No wrestlers loaded (check <code>SUPABASE_SERVICE_ROLE_KEY</code>). Autocomplete and the visual builder need a roster.
        </p>
      ) : null}
      <AddBoxscoreEventForm wrestlers={wrestlers} initialTagTeamData={initialTagTeamData} mergedOptions={mergedOptions} />
    </div>
  );
}
