"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/** Above this, split live preview sync-renders the whole doc and can freeze the tab after large .docx imports. */
const LIVE_PREVIEW_MAX_CHARS = 65_000;

/**
 * Markdown body field with toolbar (headings, bold, lists, link, code, etc.) and live preview.
 */
export function ArticleMarkdownEditor({ value, onChange, disabled }: Props) {
  const preview = value.length > LIVE_PREVIEW_MAX_CHARS ? "edit" : "live";

  return (
    <div className="admin-article-md-wrap" id="article-markdown-editor" data-color-mode="light">
      {value.length > LIVE_PREVIEW_MAX_CHARS ? (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          Long article: showing edit view only (toggle split preview from the toolbar if you need it).
        </p>
      ) : null}
      <MDEditor
        value={value}
        onChange={(v) => onChange(typeof v === "string" ? v : "")}
        height={420}
        visibleDragbar={false}
        enableScroll
        preview={preview}
        hideToolbar={disabled}
        textareaProps={{
          disabled,
          placeholder:
            "Write in Markdown — use the toolbar for formatting, or type **bold**, ## headings, etc.",
        }}
      />
    </div>
  );
}
