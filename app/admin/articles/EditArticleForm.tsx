"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArticleRow } from "@/lib/articles";
import { updateArticleAction, deleteArticleAction } from "./actions";
import { ArticleMarkdownEditor } from "./ArticleMarkdownEditor";

export function EditArticleForm({ article }: { article: ArticleRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(article.body);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateArticleAction(article.id, fd);
      if (res?.error) setError(res.error);
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this article permanently?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteArticleAction(article.id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="admin-article-form">
      {error ? (
        <div
          role="alert"
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: "var(--radius-sm)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}
      <label className="admin-article-label">
        Title
        <input
          name="title"
          type="text"
          required
          className="admin-article-input"
          disabled={pending}
          defaultValue={article.title}
        />
      </label>
      <label className="admin-article-label">
        Slug
        <input
          name="slug"
          type="text"
          required
          className="admin-article-input"
          disabled={pending}
          defaultValue={article.slug}
        />
      </label>
      <label className="admin-article-label">
        Excerpt (optional)
        <textarea
          name="excerpt"
          rows={2}
          className="admin-article-textarea"
          disabled={pending}
          defaultValue={article.excerpt ?? ""}
        />
      </label>
      <div className="admin-article-label">
        <span>Body (Markdown)</span>
        <ArticleMarkdownEditor value={body} onChange={setBody} disabled={pending} />
        <input type="hidden" name="body" value={body} />
      </div>
      <label className="admin-article-label inline">
        <span>Status</span>
        <select
          name="status"
          className="admin-article-select"
          disabled={pending}
          defaultValue={article.status}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <button type="submit" className="admin-article-submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="admin-article-delete"
          disabled={pending}
        >
          Delete
        </button>
      </div>
    </form>
  );
}
