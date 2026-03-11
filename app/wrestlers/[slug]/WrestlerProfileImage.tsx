"use client";

import { useState } from "react";

type Props = {
  fullImageUrl: string;
  fallbackImageUrl: string | null;
  alt: string;
  /** Use "full" for large full-body display, "avatar" for small circle. */
  variant?: "full" | "avatar";
  /** When set and variant is "full", overlay this belt image on the wrestler (waist-level, centered). */
  beltImageUrl?: string | null;
};

export function WrestlerProfileImage({
  fullImageUrl,
  fallbackImageUrl,
  alt,
  variant = "full",
  beltImageUrl,
}: Props) {
  const [src, setSrc] = useState(fullImageUrl);
  const [errored, setErrored] = useState(false);

  const handleError = () => {
    if (errored) return;
    setErrored(true);
    if (fallbackImageUrl) setSrc(fallbackImageUrl);
    else setSrc("");
  };

  const showPlaceholder = !src || (errored && !fallbackImageUrl);

  /** Fixed height for full-body image (same on every profile); width sized to fit full body with contain. */
  const fullWidth = 180;
  const fullHeight = 280;

  if (showPlaceholder) {
    return (
      <div
        style={
          variant === "full"
            ? {
                width: fullWidth,
                height: fullHeight,
                background: "#333",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#888",
                fontSize: 14,
              }
            : {
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "#ddd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
                fontSize: 32,
              }
        }
      >
        —
      </div>
    );
  }

  if (variant === "avatar") {
    return (
      <img
        src={src}
        alt={alt}
        onError={handleError}
        style={{
          width: 120,
          height: 120,
          objectFit: "cover",
          borderRadius: "50%",
          background: "#333",
        }}
      />
    );
  }

  const showBeltOverlay = variant === "full" && beltImageUrl;

  return (
    <div style={{ position: "relative", width: fullWidth, height: fullHeight, flexShrink: 0 }}>
      <img
        src={src}
        alt={alt}
        onError={handleError}
        style={{
          display: "block",
          width: fullWidth,
          height: fullHeight,
          objectFit: "contain",
          borderRadius: 8,
          background: "#1a1a1a",
        }}
      />
      {showBeltOverlay && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "85%",
            maxWidth: fullWidth,
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <img
            src={beltImageUrl}
            alt=""
            aria-hidden
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </div>
  );
}
