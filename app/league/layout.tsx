import Link from "next/link";

export default function LeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <p style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "var(--color-blue)", textDecoration: "none" }}>← Home</Link>
      </p>
      {children}
    </>
  );
}
