"use client";

import { useState, useTransition } from "react";
import { createArticleAction } from "./actions";
import { ArticleImageUpload } from "./ArticleImageUpload";
import { ArticleMarkdownEditor } from "./ArticleMarkdownEditor";
import { DocxBodyImport } from "./DocxBodyImport";

export function NewArticleForm() {
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [byline, setByline] = useState("");
  const [mdEditorKey, setMdEditorKey] = useState(0);
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
      <div className="admin-article-label">
        <span>Body (Markdown)</span>
        <DocxBodyImport
          onMarkdown={setBody}
          onImportApplied={() => setMdEditorKey((k) => k + 1)}
          disabled={pending}
          hasExistingBody={body.trim().length > 0}
        />
        <ArticleImageUpload
          articleId={null}
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
