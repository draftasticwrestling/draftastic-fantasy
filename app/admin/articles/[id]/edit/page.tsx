import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getArticleByIdForAdmin } from "@/lib/articles";
import { EditArticleForm } from "../../EditArticleForm";

export const metadata = {
  title: "Edit article — Admin",
};

export default async function AdminEditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireSiteAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const article = await getArticleByIdForAdmin(id);
  if (!article) notFound();

  return (
    <main className="app-page" style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/admin/articles" className="app-link">← Articles</Link>
        {article.status === "published" ? (
          <>
            {" · "}
            <Link href={`/news/${encodeURIComponent(article.slug)}`} className="app-link" target="_blank" rel="noopener noreferrer">
              View live
            </Link>
          </>
        ) : null}
      </p>
      {sp.saved ? (
        <p style={{ marginBottom: 16, color: "#166534", fontSize: 14 }}>Saved.</p>
      ) : null}
      <h1 style={{ fontSize: "1.5rem", marginBottom: 20 }}>Edit article</h1>
      <EditArticleForm article={article} />
    </main>
  );
}
