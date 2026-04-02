import Link from "next/link";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { NewArticleForm } from "../NewArticleForm";

export const metadata = {
  title: "New article — Admin",
};

export default async function AdminNewArticlePage() {
  await requireSiteAdmin();
  return (
    <main className="app-page" style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/admin/articles" className="app-link">← Articles</Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 20 }}>New article</h1>
      <NewArticleForm />
    </main>
  );
}
