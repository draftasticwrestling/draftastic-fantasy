import Link from "next/link";
import { BoxscoreSubNav } from "./BoxscoreSubNav";

export default function BoxscoreAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p style={{ marginBottom: 12 }}>
        <Link href="/internal-admin/boxscore" className="app-link" style={{ fontSize: 14 }}>
          ← Boxscore admin home
        </Link>
      </p>
      <BoxscoreSubNav />
      {children}
    </>
  );
}
