"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArticleRow } from "@/lib/articles";
import { updateArticleAction, deleteArticleAction } from "./actions";
import { ArticleImageLibrary } from "./ArticleImageLibrary";
import { ArticleImageUpload } from "./ArticleImageUpload";
import { ArticleMarkdownEditor } from "./ArticleMarkdownEditor";
import { DocxBodyImport } from "./DocxBodyImport";
import { ArticleThumbnailPicker } from "./ArticleThumbnailPicker";

export function EditArticleForm({ article }: { article: ArticleRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(article.body);
  const [byline, setByline] = useState(() => article.byline ?? "");
  const [mdEditorKey, setMdEditorKey] = useState(0);
  const [imageLibKey, setImageLibKey] = useState(0);
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
      <fieldset
        className="admin-article-series-fieldset"
        style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: 14, margin: 0 }}
      >
        <legend style={{ padding: "0 8px", fontSize: 14, fontWeight: 600 }}>Series (optional)</legend>
        <p className="admin-article-field-hint" style={{ marginTop: 0 }}>
          Same <strong>series slug</strong> on each installment links them on the live article. Run{" "}
          <code style={{ fontSize: 11 }}>supabase/articles_series.sql</code> if save errors mention series columns.
        </p>
        <label className="admin-article-label">
          Series slug
          <input
            name="series_slug"
            type="text"
            className="admin-article-input"
            disabled={pending}
            placeholder="e.g. dillster-big-board-2026"
            maxLength={96}
            autoComplete="off"
            defaultValue={article.series_slug ?? ""}
          />
        </label>
        <label className="admin-article-label">
          Series title (optional)
          <input
            name="series_title"
            type="text"
            className="admin-article-input"
            disabled={pending}
            placeholder="Shown above the part links"
            maxLength={120}
            autoComplete="off"
            defaultValue={article.series_title ?? ""}
          />
        </label>
        <label className="admin-article-label">
          Part number (optional)
          <input
            name="series_part"
            type="number"
            min={1}
            className="admin-article-input"
            disabled={pending}
            placeholder="1, 2, 3…"
            defaultValue={article.series_part != null ? String(article.series_part) : ""}
          />
        </label>
      </fieldset>
      <div className="admin-article-label">
        <span>Body (Markdown)</span>
        <DocxBodyImport
          onMarkdown={setBody}
          onImportApplied={() => setMdEditorKey((k) => k + 1)}
          disabled={pending}
          hasExistingBody={body.trim().length > 0}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ArticleImageUpload
            articleId={article.id}
            disabled={pending}
            onInsertMarkdown={(md) => {
              setBody((b) => (b.trim() ? `${md}\n\n${b}` : `${md}\n`));
              setMdEditorKey((k) => k + 1);
            }}
            onUploaded={() => setImageLibKey((k) => k + 1)}
          />
          <ArticleImageLibrary
            refreshKey={imageLibKey}
            disabled={pending}
            onInsertMarkdown={(md) => {
              setBody((b) => (b.trim() ? `${md}\n\n${b}` : `${md}\n`));
              setMdEditorKey((k) => k + 1);
            }}
          />
        </div>
        <ArticleMarkdownEditor key={mdEditorKey} value={body} onChange={setBody} disabled={pending} />
        <input type="hidden" name="body" value={body} />
        <ArticleThumbnailPicker
          body={body}
          initialThumbnail={article.thumbnail_image_url ?? null}
          disabled={pending}
        />
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
