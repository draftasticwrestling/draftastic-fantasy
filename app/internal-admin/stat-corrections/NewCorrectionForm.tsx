"use client";

import { useState, useTransition } from "react";
import { createEventScoreCorrectionAction } from "./actions";

function defaultVisibleAtLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function NewCorrectionForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createEventScoreCorrectionAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="admin-article-form" style={{ maxWidth: 640 }}>
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
        League slug (optional)
        <input
          name="league_slug"
          type="text"
          className="admin-article-input"
          disabled={pending}
          placeholder="Leave empty for all leagues"
        />
      </label>
      <label className="admin-article-label">
        Event id
        <input name="event_id" type="text" required className="admin-article-input" disabled={pending} placeholder="DB id or slug used in /event-results/…" />
      </label>
      <label className="admin-article-label">
        Title
        <input name="title" type="text" required className="admin-article-input" disabled={pending} />
      </label>
      <label className="admin-article-label">
        Body (Markdown)
        <textarea name="body_markdown" rows={8} className="admin-article-textarea" disabled={pending} />
      </label>
      <label className="admin-article-label">
        Visible at (local time)
        <input
          name="visible_at"
          type="datetime-local"
          className="admin-article-input"
          disabled={pending}
          defaultValue={defaultVisibleAtLocal()}
        />
      </label>
      <button type="submit" className="admin-article-submit" disabled={pending}>
        {pending ? "Publishing…" : "Publish correction"}
      </button>
    </form>
  );
}
