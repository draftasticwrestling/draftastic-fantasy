import type { CSSProperties } from "react";
import Image from "next/image";

type Props = {
  avatarUrl?: string | null;
  /** Shown when there is no image (first character, uppercased). */
  fallbackLetter?: string;
  size: number;
  /** CSS border-radius, e.g. 10 or "999px" */
  radius?: number | string;
  alt: string;
  className?: string;
  /** Extra wrapper styles (e.g. standings row). */
  style?: CSSProperties;
  /** Dark standings row placeholder vs light sidebar. */
  variant?: "standings" | "sidebar";
};

/**
 * Manager image URL (typically resolved from league override + profile default), or initial-style placeholder.
 */
export function ManagerAvatar({
  avatarUrl,
  fallbackLetter,
  size,
  radius = 10,
  alt,
  className,
  style,
  variant = "sidebar",
}: Props) {
  const trimmed = avatarUrl?.trim();
  const letter = (fallbackLetter?.trim().charAt(0) || "?").toUpperCase();
  const r = typeof radius === "number" ? `${radius}px` : radius;

  if (trimmed) {
    /** Standings thumbnails are small; bias crop toward upper area so faces read better on full-body uploads. */
    const objectPosition =
      variant === "standings" ? ("50% 22%" as const) : ("50% 50%" as const);
    return (
      <Image
        src={trimmed}
        alt={alt}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: r,
          objectFit: "cover",
          objectPosition,
          display: "block",
          ...style,
        }}
      />
    );
  }

  const placeholderBg =
    variant === "standings"
      ? "linear-gradient(145deg,#4b5563,#111827)"
      : "linear-gradient(145deg,#e5e7eb,#9ca3af)";
  const placeholderColor = variant === "standings" ? "#e5e7eb" : "#374151";

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(12, Math.round(size * 0.42)),
        fontWeight: 700,
        background: placeholderBg,
        color: placeholderColor,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
