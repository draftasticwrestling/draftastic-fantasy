"use client";

import { useState, useTransition } from "react";
import { createArticleAction } from "./actions";

export function NewArticleForm() {
  const [error, setError] = useState<string | null>(null);
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
        Body (Markdown)
        <textarea name="body" rows={16} className="admin-article-textarea mono" disabled={pending} />
      </label>
      <label className="admin-article-label inline">
        <span>Status</span>
        <select name="status" className="admin-article-select" disabled={pending}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      <button type="submit" className="admin-article-submit" disabled={pending}>
        {pending ? "Saving…" : "Create article"}
      </button>
    </form>
  );
}
