"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Markdown body field with toolbar (headings, bold, lists, link, code, etc.) and live preview.
 */
export function ArticleMarkdownEditor({ value, onChange, disabled }: Props) {
  return (
    <div className="admin-article-md-wrap" data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(v) => onChange(typeof v === "string" ? v : "")}
        height={420}
        visibleDragbar={false}
        enableScroll
        preview="live"
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
