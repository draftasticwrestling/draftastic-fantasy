"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * First image in article markdown: framed “lead” treatment + optional full-size lightbox.
 * Subsequent images render as plain body images (see ArticleMarkdown).
 */
export function ArticleLeadImage({ src, alt, className, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!src) return null;

  return (
    <>
      <figure className="article-md-lead-img-frame">
        <div className="article-md-lead-img-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...rest}
            src={src}
            alt={alt ?? ""}
            className={["article-md-lead-img", className].filter(Boolean).join(" ")}
            decoding="async"
          />
        </div>
        <figcaption className="article-md-lead-img-caption">
          <button type="button" className="article-md-lead-img-expand" onClick={() => setOpen(true)}>
            View full size
          </button>
        </figcaption>
      </figure>

      {mounted &&
        open &&
        createPortal(
          <div
            className="article-md-img-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Full size image"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div className="article-md-img-lightbox-inner">
              <button type="button" className="article-md-img-lightbox-close" onClick={close} aria-label="Close">
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt ?? ""} className="article-md-img-lightbox-img" decoding="async" />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
