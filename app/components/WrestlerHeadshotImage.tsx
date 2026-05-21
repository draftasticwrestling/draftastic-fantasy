"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
};

/** Strip image-only layout props so placeholders keep a full circular frame. */
function headshotVisualStyle(style?: React.CSSProperties): React.CSSProperties {
  if (!style) return {};
  const {
    objectFit: _objectFit,
    objectPosition: _objectPosition,
    display: _display,
    alignItems: _alignItems,
    justifyContent: _justifyContent,
    ...visual
  } = style;
  return visual;
}

/** Person silhouette sized like `object-fit: cover` in the headshot circle. */
function SilhouetteAvatar({
  width,
  height,
  alt,
  className,
  style,
}: Pick<Props, "width" | "height" | "alt" | "className" | "style">) {
  const visualStyle = headshotVisualStyle(style);
  return (
    <span
      role="img"
      aria-label={alt}
      className={className}
      style={{
        width,
        height,
        minWidth: width,
        minHeight: height,
        borderRadius: "50%",
        display: "inline-block",
        overflow: "hidden",
        flexShrink: 0,
        boxSizing: "border-box",
        background: "var(--color-bg-input, #eceff1)",
        ...visualStyle,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <path
          fill="var(--color-text-muted, #94a3b8)"
          d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        />
      </svg>
    </span>
  );
}

/**
 * Circular wrestler headshot: shows a neutral silhouette when `src` is empty or the image fails to load.
 */
export default function WrestlerHeadshotImage({
  src,
  alt,
  width,
  height,
  sizes,
  className,
  style,
  priority,
}: Props) {
  const [broken, setBroken] = useState(false);
  const trimmed = typeof src === "string" ? src.trim() : "";
  const showRemote = trimmed.length > 0 && !broken;

  useEffect(() => {
    setBroken(false);
  }, [trimmed]);

  const onError = useCallback(() => {
    setBroken(true);
  }, []);

  if (!showRemote) {
    return (
      <SilhouetteAvatar width={width} height={height} alt={alt} className={className} style={style} />
    );
  }

  return (
    <Image
      src={trimmed}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes ?? `${width}px`}
      className={className}
      priority={priority}
      onError={onError}
      style={{
        display: "block",
        objectFit: "cover",
        borderRadius: "50%",
        ...style,
      }}
    />
  );
}
