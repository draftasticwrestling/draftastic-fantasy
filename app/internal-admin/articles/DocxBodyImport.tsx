"use client";

import { useRef, useState } from "react";

const MAX_DOCX_BYTES = 4 * 1024 * 1024;

type Props = {
  onMarkdown: (markdown: string) => void;
  /** Bump this so @uiw/react-md-editor remounts and shows programmatic body changes (it often ignores deferred/low-priority updates). */
  onImportApplied?: () => void;
  disabled?: boolean;
  /** If true, replacing non-empty body asks for confirmation first. */
  hasExistingBody: boolean;
};

/**
 * Uploads .docx to a site-admin API route; conversion runs on the server (Node) so the tab does not freeze.
 */
export function DocxBodyImport({ onMarkdown, onImportApplied, disabled, hasExistingBody }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".docx")) {
      setInfo(null);
      setWarn(null);
      setError("Choose a .docx file (in Google Docs: File → Download → Microsoft Word).");
      return;
    }

    if (file.size > MAX_DOCX_BYTES) {
      setInfo(null);
      setWarn(null);
      setError(
        `That file is too large (${Math.round(file.size / 1024 / 1024)} MB). Max is ${MAX_DOCX_BYTES / 1024 / 1024} MB — try splitting the doc or removing large pasted images from Google Docs.`
      );
      return;
    }

    if (hasExistingBody && !window.confirm("Replace the current body with this Word file?")) {
      return;
    }

    setConverting(true);
    setInfo(null);
    setWarn(null);
    setError(null);

    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/internal-admin/convert-docx", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        markdown?: string;
        messages?: string[];
        fallback?: "raw" | "html" | null;
      };

      if (!res.ok) {
        setError(data.error || `Upload failed (${res.status})`);
        return;
      }

      const markdown = (data.markdown ?? "").trim();
      const messages = Array.isArray(data.messages) ? data.messages.filter(Boolean) : [];

      if (markdown.length === 0) {
        setInfo(null);
        setWarn(
          (messages.length > 0 ? `${messages.join(" · ")} · ` : "") +
            "Conversion returned no text. Try exporting again from Google Docs, or paste the article in manually. If this keeps happening, tell us the doc type (e.g. all body text in one text box)."
        );
        return;
      }

      const mammothWarn = messages.length > 0 ? messages.join(" · ") : null;
      const longDocWarn =
        markdown.length > 400_000
          ? "Very long document — live preview is turned off below so the editor stays responsive."
          : null;
      setWarn([mammothWarn, longDocWarn].filter(Boolean).join(" · ") || null);

      const fallbackNote =
        data.fallback === "raw" || data.fallback === "html"
          ? " Plain-text fallback was used (Word styles didn’t map to Markdown); add ## headings and lists in the editor if you want."
          : " Review the Markdown below before publishing.";
      setInfo(`Imported “${file.name}”.${fallbackNote}`);

      // Do not wrap in startTransition: the MD editor fails to apply large controlled updates when deferred.
      onMarkdown(markdown);
      onImportApplied?.();
    } catch (err) {
      setInfo(null);
      setWarn(null);
      setError(err instanceof Error ? err.message : "Network error while uploading.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: "none" }}
          disabled={disabled || converting}
          onChange={onFile}
        />
        <button
          type="button"
          className="admin-article-docx-btn"
          disabled={disabled || converting}
          onClick={() => inputRef.current?.click()}
        >
          {converting ? "Uploading…" : "Upload Word (.docx)"}
        </button>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 520, lineHeight: 1.4 }}>
          File is converted on the server so this page stays responsive. Embedded images are not included. Max{" "}
          {MAX_DOCX_BYTES / 1024 / 1024} MB.
        </span>
      </div>
      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)" }} role="status">
          {info}
        </p>
      ) : null}
      {warn && !error ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }} role="status">
          {warn}
        </p>
      ) : null}
    </div>
  );
}
