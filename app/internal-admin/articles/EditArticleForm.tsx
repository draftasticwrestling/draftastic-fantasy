"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArticleRow } from "@/lib/articles";
import { updateArticleAction, deleteArticleAction } from "./actions";
import { ArticleImageUpload } from "./ArticleImageUpload";
import { ArticleMarkdownEditor } from "./ArticleMarkdownEditor";
import { DocxBodyImport } from "./DocxBodyImport";

export function EditArticleForm({ article }: { article: ArticleRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(article.body);
  const [byline, setByline] = useState(() => article.byline ?? "");
  const [mdEditorKey, setMdEditorKey] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setByline(article.byline ?? "");
  }, [article.id, article.updated_at]);

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
            background: "var(--color-red-bg)",
            color: "var(--color-red)",
            borderRadius: "var(--radius-sm)",
            fontSize: 14,
            border: "1px solid var(--color-border)",
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
      <label className="admin-article-label">
        Author name (optional)
        <input type="hidden" name="byline" value={byline} />
        <input
          type="text"
          className="admin-article-input"
          disabled={pending}
          placeholder="Guest writer or pen name"
          maxLength={160}
          autoComplete="off"
          value={byline}
          onChange={(e) => setByline(e.target.value)}
        />
        <span className="admin-article-field-hint">
          Overrides the byline on the public article. Clear the field and save to use your profile display name again.
        </span>
      </label>
      <div className="admin-article-label">
        <span>Body (Markdown)</span>
        <DocxBodyImport
          onMarkdown={setBody}
          onImportApplied={() => setMdEditorKey((k) => k + 1)}
          disabled={pending}
          hasExistingBody={body.trim().length > 0}
        />
        <ArticleImageUpload
          articleId={article.id}
          disabled={pending}
          onInsertMarkdown={(md) => {
            setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${md}\n` : `${md}\n`));
            setMdEditorKey((k) => k + 1);
          }}
        />
        <ArticleMarkdownEditor key={mdEditorKey} value={body} onChange={setBody} disabled={pending} />
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
          <option value="published">Published — News and home headlines</option>
          <option value="draft">Draft — not on public site</option>
        </select>
      </label>
      <p className="admin-article-status-hint">
        Only <strong>Published</strong> posts with a publish date are visible to visitors (News page and Top headlines on the home page).
      </p>
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
