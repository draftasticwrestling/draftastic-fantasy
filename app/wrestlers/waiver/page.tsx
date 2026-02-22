export const metadata = {
  title: "Waiver Order — Wrestlers — Draftastic Fantasy",
  description: "Waiver wire order for your league",
};

export default function WrestlersWaiverPage() {
  return (
    <div className="wrestlers-placeholder">
      <h2 style={{ fontSize: "1.25rem", marginBottom: 12 }}>Waiver Order</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        When multiple managers want the same free agent, waiver order determines who gets them. This page shows your league’s current waiver order.
      </p>
      <p style={{ fontSize: 14, color: "var(--color-text-dim)" }}>
        This feature is coming soon. Waiver order will be shown here once your league has it enabled.
      </p>
    </div>
  );
}
