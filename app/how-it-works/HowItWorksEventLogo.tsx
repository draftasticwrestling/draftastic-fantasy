import Image from "next/image";
import type { EventLogoKey } from "@/lib/howItWorksImages";
import { EVENT_LOGO_URLS } from "@/lib/howItWorksImages";
import styles from "./HowItWorks.module.css";

/** Renders event logo image from Supabase when URL exists, otherwise placeholder text. */
export function HowItWorksEventLogo({
  eventKey,
  placeholderText,
  className,
}: {
  eventKey: EventLogoKey;
  placeholderText: string;
  className: string;
}) {
  const url = EVENT_LOGO_URLS[eventKey];
  const hasImg = Boolean(url);
  return (
    <div className={`${className}${hasImg ? ` ${styles.hasImg}` : ""}`}>
      {hasImg && url ? (
        <Image
          src={url}
          alt=""
          width={180}
          height={80}
          sizes="(max-width: 640px) 45vw, 180px"
          loading="lazy"
        />
      ) : (
        placeholderText
      )}
    </div>
  );
}
