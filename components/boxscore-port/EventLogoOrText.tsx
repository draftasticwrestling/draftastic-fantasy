"use client";

import { useState, type CSSProperties } from "react";
import { getEventLogoPath } from "@/lib/boxscore/eventShowHeader";

const gold = "#C6A04F";

type Props = {
  name: string;
  /** Event slug/id (e.g. `royal-rumble-20250125`) so Raw/SmackDown disambiguation matches EventListBar. */
  eventId?: string | null;
  alt?: string;
  style?: CSSProperties;
  textStyle?: CSSProperties;
};

export function EventLogoOrText({ name, eventId, alt, style, textStyle }: Props) {
  const logoSrc = getEventLogoPath(name, eventId);
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoSrc} alt={alt || name} style={style} onError={() => setImgError(true)} />
    );
  }

  return <strong style={{ color: gold, ...textStyle }}>{name}</strong>;
}
