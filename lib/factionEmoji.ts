/**
 * Faction "logo" as a single allowlisted emoji (stored in league_members.faction_emoji).
 * Null in DB → default trophy everywhere.
 */

export const DEFAULT_FACTION_EMOJI = "🏆";

/** Curated grid for Edit Faction Info (order = display order). */
export const FACTION_EMOJI_CHOICES = [
  "🏆",
  "⭐",
  "🌟",
  "✨",
  "🔥",
  "⚡",
  "💪",
  "👊",
  "🤼",
  "🎯",
  "🦅",
  "🐯",
  "🦁",
  "🐺",
  "🦈",
  "🐍",
  "🎭",
  "👑",
  "💀",
  "🎪",
  "🎸",
  "📣",
  "🥇",
  "🥈",
  "🥉",
  "🏅",
  "🎬",
  "🚀",
  "🌋",
  "🛡️",
  "⚔️",
  "💎",
  "❤️",
  "🖤",
  "💜",
  "💙",
  "🤍",
  "☠️",
  "👹",
  "🎃",
  "🌙",
  "☄️",
  "🧨",
  "🎲",
] as const;

const ALLOWED = new Set<string>(FACTION_EMOJI_CHOICES as unknown as string[]);

export function isAllowedFactionEmoji(s: string): boolean {
  return ALLOWED.has(s.trim());
}

export function factionEmojiForDisplay(m: { faction_emoji?: string | null } | null | undefined): string {
  const raw = m?.faction_emoji?.trim();
  if (raw && isAllowedFactionEmoji(raw)) return raw;
  return DEFAULT_FACTION_EMOJI;
}

export function validateFactionEmojiForSave(
  raw: string | null | undefined
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || !String(raw).trim()) return { ok: true, value: null };
  const t = String(raw).trim();
  if (!isAllowedFactionEmoji(t)) {
    return { ok: false, error: "Pick a logo from the list." };
  }
  return { ok: true, value: t };
}
