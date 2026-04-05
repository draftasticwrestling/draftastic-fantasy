"use client";

import { useRef, useState } from "react";
import { focusArticleMarkdownEditorAtStart } from "@/lib/articleMarkdownEditorFocus";

const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  /** When set, files are stored under this article id in Storage (otherwise `draft`). */
  articleId?: string | null;
  disabled?: boolean;
  /** Called with a Markdown image line after a successful upload. */
  onInsertMarkdown: (markdown: string) => void;
  /** Optional bump so the MD editor remounts (same pattern as Docx import). */
  onInserted?: () => void;
  /** After a successful upload (e.g. refresh image library). */
  onUploaded?: () => void;
};

/**
 * Uploads an image to Supabase Storage (site-admin API) and appends ![alt](url) to the article body.
 */
export function ArticleImageUpload({ articleId, disabled, onInsertMarkdown, onInserted, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [alt, setAlt] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInsertedLine, setLastInsertedLine] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setInfo(null);
      setError(`Image too large (max ${MAX_BYTES / 1024 / 1024} MB).`);
      return;
    }

    setError(null);
    setInfo(null);
    setLastInsertedLine(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (articleId) fd.set("articleId", articleId);

      const res = await fetch("/api/internal-admin/article-image", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok) {
        setError(data.error || `Upload failed (${res.status}).`);
        return;
      }

      const url = data.url?.trim();
      if (!url) {
        setError("Upload succeeded but no URL was returned.");
        return;
      }

      const caption = (alt.trim() || file.name.replace(/\.[^.]+$/, "") || "Article image").replace(/]/g, "");
      const md = `![${caption}](${url})`;
      onInsertMarkdown(md);
      onInserted?.();
      onUploaded?.();
      setLastInsertedLine(md);
      setInfo(
        "Added at the top of the Markdown (left pane). You can cut the line and paste it elsewhere if you want it lower in the article. Then Save."
      );
      focusArticleMarkdownEditorAtStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error while uploading.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          disabled={disabled || busy}
          onChange={onFile}
        />
        <button
          type="button"
          className="admin-article-docx-btn"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload image"}
        </button>
        <label className="admin-article-label inline" style={{ margin: 0, flex: "1 1 200px" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Alt text (optional)</span>
          <input
            type="text"
            className="admin-article-input"
            style={{ marginTop: 4 }}
            disabled={disabled || busy}
            placeholder="Describe the image for accessibility"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={180}
          />
        </label>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.45 }}>
        JPEG, PNG, WebP, or GIF, up to 5 MB. Choosing a file uploads it and <strong>automatically adds</strong> an
        image line at the <strong>top of the Markdown body</strong> (same as typing{" "}
        <code style={{ fontSize: 11 }}>![caption](url)</code>
        ). Then <strong>Save</strong> the article so it appears on the live News page. Run{" "}
        <code style={{ fontSize: 11 }}>supabase/article_images_storage.sql</code> once if upload fails.
      </p>
      {lastInsertedLine ? (
        <pre
          style={{
            margin: 0,
            padding: 10,
            fontSize: 12,
            lineHeight: 1.45,
            borderRadius: 6,
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-elevated, #f1f5f9)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 120,
            overflow: "auto",
          }}
          aria-label="Inserted Markdown line"
        >
          {lastInsertedLine}
        </pre>
      ) : null}
      {info ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>{info}</p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
