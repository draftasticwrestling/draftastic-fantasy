import Link from "next/link";
import { listAllArticlesForAdmin } from "@/lib/articles";

export const metadata = {
  title: "Articles — Site admin",
};

export default async function InternalAdminArticlesListPage() {
  const rows = await listAllArticlesForAdmin();

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Articles</h1>
        <Link
          href="/internal-admin/articles/new"
          style={{
            padding: "10px 18px",
            background: "var(--color-blue)",
            color: "var(--color-text-inverse)",
            textDecoration: "none",
            borderRadius: "var(--radius)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          New article
        </Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginTop: 8, marginBottom: 24 }}>
        Draft and publish news posts (Markdown). Public site shows only published articles with a set publish date.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No articles yet. Create one to get started.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((a) => (
            <li
              key={a.id}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <div>
                <Link href={`/internal-admin/articles/${a.id}/edit`} className="app-link" style={{ fontWeight: 600 }}>
                  {a.title}
                </Link>
                <span style={{ marginLeft: 10, fontSize: 13, color: "var(--color-text-dim)" }}>
                  {a.status}
                  {a.status === "published" && a.published_at ? ` · ${a.published_at.slice(0, 10)}` : ""}
                </span>
              </div>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>/{a.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
