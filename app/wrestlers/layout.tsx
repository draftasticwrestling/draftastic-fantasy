import Link from "next/link";

export default function WrestlersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1200,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <p style={{ marginBottom: 16 }}>
        <Link href="/" style={{ color: "var(--color-blue)", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>

      {children}
    </main>
  );
}
