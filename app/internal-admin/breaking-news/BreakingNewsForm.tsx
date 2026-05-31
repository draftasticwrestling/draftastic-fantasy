"use client";

import { useState, useTransition } from "react";
import {
  createBreakingNewsAction,
  deleteBreakingNewsAction,
  updateBreakingNewsAction,
} from "./actions";
import type { BreakingNewsRow } from "@/lib/breakingNews";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

type Props = {
  mode: "create" | "edit";
  row?: BreakingNewsRow;
};

export function BreakingNewsForm({ mode, row }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        mode === "create" ? await createBreakingNewsAction(fd) : await updateBreakingNewsAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  function onDelete() {
    if (!row || !window.confirm("Delete this breaking news item?")) return;
    setError(null);
    const fd = new FormData();
    fd.set("id", row.id);
    startTransition(async () => {
      const res = await deleteBreakingNewsAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="admin-article-form" style={{ maxWidth: 640 }}>
      {mode === "edit" && row ? <input type="hidden" name="id" value={row.id} /> : null}
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
        Message
        <textarea
          name="message"
          rows={2}
          required
          maxLength={500}
          className="admin-article-textarea"
          disabled={pending}
          defaultValue={row?.message ?? ""}
          placeholder="Clash in Italy results are live — check your league standings."
        />
      </label>
      <label className="admin-article-label">
        Link URL (optional)
        <input
          name="link_href"
          type="text"
          className="admin-article-input"
          disabled={pending}
          defaultValue={row?.link_href ?? ""}
          placeholder="/event-results/clash-in-italy or https://…"
        />
      </label>
      <label className="admin-article-label">
        Link label (optional)
        <input
          name="link_label"
          type="text"
          className="admin-article-input"
          disabled={pending}
          maxLength={80}
          defaultValue={row?.link_label ?? ""}
          placeholder="Read more"
        />
      </label>
      <label className="admin-article-label">
        Sort order
        <input
          name="sort_order"
          type="number"
          className="admin-article-input"
          disabled={pending}
          defaultValue={row?.sort_order ?? 0}
          style={{ maxWidth: 120 }}
        />
      </label>
      <p style={{ margin: "-8px 0 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
        Lower numbers appear first when multiple items are active.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="admin-article-label">
          Start (local, optional)
          <input
            name="starts_at"
            type="datetime-local"
            className="admin-article-input"
            disabled={pending}
            defaultValue={toLocalInputValue(row?.starts_at ?? null)}
          />
        </label>
        <label className="admin-article-label">
          End (local, optional)
          <input
            name="ends_at"
            type="datetime-local"
            className="admin-article-input"
            disabled={pending}
            defaultValue={toLocalInputValue(row?.ends_at ?? null)}
          />
        </label>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input name="enabled" type="checkbox" defaultChecked={row?.enabled ?? true} disabled={pending} />
        Enabled
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <button type="submit" className="admin-article-submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create item" : "Save changes"}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            className="admin-article-submit"
            disabled={pending}
            onClick={onDelete}
            style={{ background: "var(--color-red)", borderColor: "var(--color-red)" }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
