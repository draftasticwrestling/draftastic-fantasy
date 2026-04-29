import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLE_BYLINE_MIGRATION_SQL } from "@/lib/articleBylineMigrationSql";
import { getArticleByIdForAdmin } from "@/lib/articles";
import { EditArticleForm } from "../../EditArticleForm";

export const metadata = {
  title: "Edit article — Site admin",
};

export default async function InternalAdminEditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; bylinePending?: string; thumbnailPending?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const article = await getArticleByIdForAdmin(id);
  if (!article) notFound();

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/articles" className="app-link">
          ← Articles
        </Link>
        {article.status === "published" ? (
          <>
            {" · "}
            <Link
              href={`/news/${encodeURIComponent(article.slug)}`}
              className="app-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              View live
            </Link>
          </>
        ) : null}
      </p>
      {sp.bylinePending ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-amber-bg, rgba(245, 158, 11, 0.12))",
            color: "var(--color-text)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: "0 0 10px" }}>
            <strong>Author name was not saved.</strong> The article itself is saved. Add the database field once in
            Supabase, then click <strong>Save changes</strong> again with the author name filled in.
          </p>
          <ol style={{ margin: "0 0 12px", paddingLeft: 22 }}>
            <li style={{ marginBottom: 6 }}>Open your project at <strong>supabase.com</strong> → <strong>SQL Editor</strong>.</li>
            <li style={{ marginBottom: 6 }}>
              Paste the script below, click <strong>Run</strong> (it adds <code style={{ fontSize: 13 }}>byline</code>{" "}
              and refreshes the API cache).
            </li>
            <li>Return here and save again.</li>
          </ol>
          <pre
            style={{
              margin: 0,
              padding: 12,
              fontSize: 12,
              lineHeight: 1.45,
              overflow: "auto",
              maxHeight: 220,
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-elevated, #f1f5f9)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {ARTICLE_BYLINE_MIGRATION_SQL}
          </pre>
        </div>
      ) : null}
      {sp.thumbnailPending ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-amber-bg, rgba(245, 158, 11, 0.12))",
            color: "var(--color-text)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Feed / home thumbnail was not saved.</strong> The article is saved without that column. Run{" "}
            <code style={{ fontSize: 13 }}>supabase/articles_thumbnail_image_url.sql</code> in the Supabase SQL Editor,
            then click <strong>Save changes</strong> again to store your thumbnail choice.
          </p>
        </div>
      ) : null}
      {sp.saved ? (
        <p style={{ marginBottom: 16, color: "var(--color-success)", fontSize: 14, fontWeight: 600 }}>Saved.</p>
      ) : null}
      <h1 style={{ fontSize: "1.5rem", marginBottom: 20 }}>Edit article</h1>
      <EditArticleForm article={article} />
    </div>
  );
}
