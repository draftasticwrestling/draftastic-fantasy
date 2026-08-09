import Link from "next/link";
import { BoxscoreSubNav } from "./BoxscoreSubNav";

export default function BoxscoreAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p style={{ marginBottom: 12 }}>
        <Link href="/internal-admin" className="app-link" style={{ fontSize: 14 }}>
          ← Site admin
        </Link>
      </p>
      <BoxscoreSubNav />
      {children}
    </>
  );
}
