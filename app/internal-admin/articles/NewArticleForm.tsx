"use client";

import { useState, useTransition } from "react";
import { createArticleAction } from "./actions";
import { ArticleImageLibrary } from "./ArticleImageLibrary";
import { ArticleImageUpload } from "./ArticleImageUpload";
import { ArticleMarkdownEditor } from "./ArticleMarkdownEditor";
import { DocxBodyImport } from "./DocxBodyImport";

export function NewArticleForm() {
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [byline, setByline] = useState("");
  const [mdEditorKey, setMdEditorKey] = useState(0);
  const [imageLibKey, setImageLibKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createArticleAction(fd);
      if (res?.error) setError(res.error);
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
        <input name="title" type="text" required className="admin-article-input" disabled={pending} />
      </label>
      <label className="admin-article-label">
        Slug (optional — generated from title if empty)
        <input name="slug" type="text" className="admin-article-input" disabled={pending} placeholder="my-article-slug" />
      </label>
      <label className="admin-article-label">
        Excerpt (optional)
        <textarea name="excerpt" rows={2} className="admin-article-textarea" disabled={pending} />
      </label>
      <label className="admin-article-label">
        Author name (optional)
        <input type="hidden" name="byline" value={byline} />
        <input
          type="text"
          className="admin-article-input"
          disabled={pending}
          placeholder="Shown under the title — use for guest writers"
          maxLength={160}
          autoComplete="off"
          value={byline}
          onChange={(e) => setByline(e.target.value)}
        />
        <span className="admin-article-field-hint">
          Leave blank to use your account display name. You still post as site admin; this only changes the public credit line.
        </span>
      </label>
      <fieldset
        className="admin-article-series-fieldset"
        style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: 14, margin: 0 }}
      >
        <legend style={{ padding: "0 8px", fontSize: 14, fontWeight: 600 }}>Series (optional)</legend>
        <p className="admin-article-field-hint" style={{ marginTop: 0 }}>
          Use the same <strong>series slug</strong> on each installment. The live article shows links to every published
          part in that series. Run <code style={{ fontSize: 11 }}>supabase/articles_series.sql</code> if save errors
          mention series columns.
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
          />
        </label>
        <label className="admin-article-label">
          Series title (optional)
          <input
            name="series_title"
            type="text"
            className="admin-article-input"
            disabled={pending}
            placeholder="Shown above the part links, e.g. Dillster's Big Board"
            maxLength={120}
            autoComplete="off"
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
            articleId={null}
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
      </div>
      <label className="admin-article-label inline">
        <span>Status</span>
        <select
          name="status"
          className="admin-article-select"
          disabled={pending}
          defaultValue="published"
        >
          <option value="published">Published — shows on News and Top headlines</option>
          <option value="draft">Draft — site admin only</option>
        </select>
      </label>
      <p className="admin-article-status-hint">
        Drafts never appear on the public site. Choose Published when you are ready to go live.
      </p>
      <button type="submit" className="admin-article-submit" disabled={pending}>
        {pending ? "Saving…" : "Create article"}
      </button>
    </form>
  );
}
