import Link from "next/link";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";

type Props = {
  eventId?: string;
  className?: string;
};

/** Site-admin shortcut bar when viewing public boxscore pages. */
export async function BoxscoreAdminQuickLinks({ eventId, className }: Props) {
  if (!(await getIsSiteAdmin())) return null;

  return (
    <div
      className={className}
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
        fontSize: 14,
      }}
    >
      <strong style={{ marginRight: 8 }}>Site admin:</strong>
      <Link href="/internal-admin/boxscore/events" className="app-link" style={{ marginRight: 12, fontWeight: 600 }}>
        All events
      </Link>
      {eventId ? (
        <Link
          href={`/internal-admin/boxscore/events/${encodeURIComponent(eventId)}/edit`}
          className="app-link"
          style={{ marginRight: 12, fontWeight: 600 }}
        >
          Edit this event
        </Link>
      ) : null}
      <Link href="/internal-admin/boxscore/events/new" className="app-link" style={{ marginRight: 12 }}>
        Add event
      </Link>
      <Link href="/internal-admin/boxscore/events?status=live" className="app-link" style={{ marginRight: 12 }}>
        Live events
      </Link>
      <Link href="/internal-admin/boxscore/championships" className="app-link">
        Championships
      </Link>
    </div>
  );
}
