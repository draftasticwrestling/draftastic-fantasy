import type { Metadata } from "next";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { InternalAdminShell } from "./InternalAdminShell";

export const metadata: Metadata = {
  title: "Site admin — Draftastic",
  robots: { index: false, follow: false },
};

export default async function InternalAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSiteAdmin();

  return <InternalAdminShell>{children}</InternalAdminShell>;
}
