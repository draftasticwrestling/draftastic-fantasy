"use client";

import { useMemo } from "react";
import { listArticleImageUrls } from "@/lib/articleFirstImage";

function truncateUrl(u: string, max = 72): string {
  if (u.length <= max) return u;
  return `${u.slice(0, max - 1)}…`;
}

type Props = {
  body: string;
  /** Saved value; ignored if not among current body images */
  initialThumbnail: string | null | undefined;
  disabled?: boolean;
};

/**
 * Choose which in-article image URL is used for News list + home “The latest” cards.
 */
export function ArticleThumbnailPicker({ body, initialThumbnail, disabled }: Props) {
  const urls = useMemo(() => listArticleImageUrls(body), [body]);
  const selectKey = `${urls.join("\n")}|${initialThumbnail ?? ""}`;
  const defaultValue =
    initialThumbnail && urls.includes(initialThumbnail.trim()) ? initialThumbnail.trim() : "";

  return (
    <fieldset
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        padding: 14,
        margin: "16px 0 0",
      }}
    >
      <legend style={{ padding: "0 8px", fontSize: 14, fontWeight: 600 }}>Feed & home thumbnail</legend>
      <p className="admin-article-field-hint" style={{ marginTop: 0 }}>
        Pick which image appears on the <strong>News</strong> page and the home hub cards. Leave as default to use the{" "}
        <strong>first image</strong> in the article body.
      </p>
      {urls.length === 0 ? (
        <p className="admin-article-field-hint" style={{ margin: "8px 0 0" }}>
          Add images to the body (Markdown <code style={{ fontSize: 11 }}>![](url)</code>) to enable thumbnail choices.
        </p>
      ) : (
        <label className="admin-article-label" style={{ marginBottom: 0 }}>
          Thumbnail image
          <select
            key={selectKey}
            name="thumbnail_image_url"
            className="admin-article-select"
            disabled={disabled}
            defaultValue={defaultValue}
          >
            <option value="">First image in article (default)</option>
            {urls.map((u, i) => (
              <option key={`${i}-${u}`} value={u}>
                Image {i + 1}: {truncateUrl(u)}
              </option>
            ))}
          </select>
        </label>
      )}
      {urls.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "flex-start" }}>
          {urls.map((u, i) => (
            <div
              key={u}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: 6,
                background: "var(--color-bg-elevated)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" style={{ display: "block", maxWidth: 120, maxHeight: 72, objectFit: "contain" }} />
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginTop: 4 }}>
                #{i + 1}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
