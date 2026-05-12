import { ManagerAvatar } from "@/app/components/ManagerAvatar";
import type { LeagueMember } from "@/lib/leagues";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";

export function matchupOwnerFallbackInitial(m: LeagueMember | null | undefined): string {
  const s = (m?.team_name?.trim() || m?.display_name?.trim() || "?").charAt(0);
  return s.toUpperCase();
}

export function MatchupOwnerAvatarRing({
  member,
  size = 28,
}: {
  member: LeagueMember | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: "flex",
        flexShrink: 0,
        borderRadius: 999,
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        background: "var(--color-bg-card)",
      }}
    >
      <ManagerAvatar
        avatarUrl={resolvedManagerAvatarUrl(member ?? {})}
        fallbackLetter={matchupOwnerFallbackInitial(member)}
        size={size}
        radius={999}
        alt=""
        variant="sidebar"
      />
    </span>
  );
}

/** Avatar + faction label (e.g. table column header). */
export function MatchupColumnHeading({
  member,
  label,
  avatarSize = 28,
}: {
  member: LeagueMember | null;
  label: string;
  avatarSize?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <MatchupOwnerAvatarRing member={member} size={avatarSize} />
      <span style={{ minWidth: 0, lineHeight: 1.25 }}>{label}</span>
    </div>
  );
}
