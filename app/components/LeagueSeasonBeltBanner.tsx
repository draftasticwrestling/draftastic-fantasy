import Image from "next/image";
import type { LeagueSeasonBelt } from "@/lib/leagueStructure";

type Props = {
  belt: LeagueSeasonBelt;
  /** Desktop season rail uses a narrower max width; mobile/pathway uses full width. */
  variant?: "rail" | "full";
};

export function LeagueSeasonBeltBanner({ belt, variant = "rail" }: Props) {
  if (variant === "full") {
    return (
      <Image
        src={belt.src}
        alt={belt.alt}
        width={560}
        height={120}
        sizes="100vw"
        style={{ display: "block", width: "100%", height: "auto" }}
      />
    );
  }

  return (
    <div className="lm-season-rail-banner">
      <Image
        src={belt.src}
        alt={belt.alt}
        width={560}
        height={120}
        className="lm-season-rail-banner-img"
        sizes="(max-width: 900px) 100vw, 280px"
      />
    </div>
  );
}
