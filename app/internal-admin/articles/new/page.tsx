import Link from "next/link";
import { NewArticleForm } from "../NewArticleForm";

export const metadata = {
  title: "New article — Site admin",
};

export default function InternalAdminNewArticlePage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/articles" className="app-link">
          ← Articles
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 20 }}>New article</h1>
      <NewArticleForm />
    </div>
  );
}
