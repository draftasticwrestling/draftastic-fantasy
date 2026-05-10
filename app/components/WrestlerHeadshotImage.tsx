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

/** Generic person silhouette (Material-style) for missing / failed headshots */
function SilhouetteAvatar({
  width,
  height,
  alt,
  className,
  style,
}: Pick<Props, "width" | "height" | "alt" | "className" | "style">) {
  const { objectFit: _o, ...rest } = style ?? {};
  return (
    <span
      role="img"
      aria-label={alt}
      className={className}
      style={{
        width,
        height,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #3d3d3d 0%, #2a2a2a 100%)",
        overflow: "hidden",
        flexShrink: 0,
        boxSizing: "border-box",
        ...rest,
      }}
    >
      <svg
        width={Math.round(width * 0.5)}
        height={Math.round(height * 0.5)}
        viewBox="0 0 24 24"
        aria-hidden
        style={{ opacity: 0.88 }}
      >
        <path
          fill="#9a9a9a"
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
