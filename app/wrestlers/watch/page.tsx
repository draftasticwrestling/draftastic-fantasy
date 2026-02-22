export const metadata = {
  title: "Watch List — Wrestlers — Draftastic Fantasy",
  description: "Wrestlers on your watch list",
};

export default function WrestlersWatchPage() {
  return (
    <div className="wrestlers-placeholder">
      <h2 style={{ fontSize: "1.25rem", marginBottom: 12 }}>Watch List</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Wrestlers you have added to your watch list will appear here. Use Add Wrestlers to add wrestlers to your watch list.
      </p>
      <p style={{ fontSize: 14, color: "var(--color-text-dim)" }}>
        This feature is coming soon.
      </p>
    </div>
  );
}
