"use client";

import { useCallback, useEffect, useState } from "react";
import { focusArticleMarkdownEditorAtStart } from "@/lib/articleMarkdownEditorFocus";

type Img = { path: string; publicUrl: string; createdAt: string };

type Props = {
  disabled?: boolean;
  /** Increment to refetch the library (e.g. after a new upload). */
  refreshKey?: number;
  onInsertMarkdown: (markdown: string) => void;
  onInserted?: () => void;
};

function titleCaseFromFilename(base: string): string {
  return base
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 80);
}

/**
 * Lists images the signed-in admin previously uploaded to article-images (same Supabase folder layout as upload).
 */
export function ArticleImageLibrary({ disabled, refreshKey = 0, onInsertMarkdown, onInserted }: Props) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<Img[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal-admin/article-images", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; images?: Img[] };
      if (!res.ok) {
        setError(data.error || `Could not list images (${res.status}).`);
        setImages([]);
        return;
      }
      setImages(Array.isArray(data.images) ? data.images : []);
    } catch {
      setError("Network error loading image list.");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, refreshKey, load]);

  function insert(img: Img) {
    const base = img.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "image";
    const alt = titleCaseFromFilename(base).replace(/]/g, "");
    onInsertMarkdown(`![${alt}](${img.publicUrl})`);
    onInserted?.();
    focusArticleMarkdownEditorAtStart();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        className="admin-article-docx-btn"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide image library" : "Reuse uploaded image"}
      </button>
      {open ? (
        <>
          {loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</p>
          ) : null}
          {error ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-red)" }} role="alert">
              {error}
            </p>
          ) : null}
          {!loading && images.length === 0 && !error ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.45 }}>
              No images yet. Upload one with <strong>Upload image</strong> — it will show here so you can drop the
              same file into other articles without uploading again.
            </p>
          ) : null}
          {images.length > 0 ? (
            <ul className="admin-article-image-lib">
              {images.map((img) => (
                <li key={img.path}>
                  <button
                    type="button"
                    className="admin-article-image-lib-btn"
                    disabled={disabled}
                    onClick={() => insert(img)}
                    title="Insert into article body"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.publicUrl} alt="" className="admin-article-image-lib-thumb" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
