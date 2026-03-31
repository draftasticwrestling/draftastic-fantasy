"use client";

import { useState, type CSSProperties } from "react";
import { getEventLogoPath } from "@/lib/boxscore/eventShowHeader";

const gold = "#C6A04F";

type Props = {
  name: string;
  alt?: string;
  style?: CSSProperties;
  textStyle?: CSSProperties;
};

export function EventLogoOrText({ name, alt, style, textStyle }: Props) {
  const logoSrc = getEventLogoPath(name);
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoSrc} alt={alt || name} style={style} onError={() => setImgError(true)} />
    );
  }

  return <strong style={{ color: gold, ...textStyle }}>{name}</strong>;
}
