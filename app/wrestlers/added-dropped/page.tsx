export const metadata = {
  title: "Added / Dropped — Wrestlers — Draftastic Fantasy",
  description: "Recently added and dropped wrestlers in your league",
};

export default function WrestlersAddedDroppedPage() {
  return (
    <div className="wrestlers-placeholder">
      <h2 style={{ fontSize: "1.25rem", marginBottom: 12 }}>Added / Dropped</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        See which wrestlers were recently added to rosters or dropped to free agency in your league.
      </p>
      <p style={{ fontSize: 14, color: "var(--color-text-dim)" }}>
        This feature is coming soon. League activity will appear here once available.
      </p>
    </div>
  );
}
