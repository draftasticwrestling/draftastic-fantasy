import countries from "@/components/boxscore-port/data/countries";

export type NationalityFlagDisplay =
  | { kind: "emoji"; emoji: string; label: string }
  | { kind: "img"; src: string; label: string };

/**
 * Map Pro Wrestling Boxscore nationality string (country name) to a flag emoji or flag image URL.
 */
export function getNationalityFlagDisplay(nationality: string | null | undefined): NationalityFlagDisplay | null {
  const n = nationality?.trim();
  if (!n) return null;
  const lower = n.toLowerCase();
  const c =
    countries.find((row) => row.name === n) ?? countries.find((row) => row.name.toLowerCase() === lower);
  if (!c) return null;
  if ("flagImage" in c && c.flagImage) {
    return { kind: "img", src: String(c.flagImage), label: n };
  }
  if (c.flag) {
    return { kind: "emoji", emoji: c.flag, label: n };
  }
  return null;
}
