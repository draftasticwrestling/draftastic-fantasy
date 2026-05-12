import { ManagerAvatar } from "@/app/components/ManagerAvatar";
import type { LeagueMember } from "@/lib/leagues";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";

function matchupOwnerFallbackInitial(m: LeagueMember | null | undefined): string {
  const s = (m?.team_name?.trim() || m?.display_name?.trim() || "?").charAt(0);
  return s.toUpperCase();
}

export function MatchupOwnerAvatarRing({
  member,
  size = 42,
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
        borderRadius: 0,
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        background: "var(--color-bg-card)",
      }}
    >
      <ManagerAvatar
        avatarUrl={resolvedManagerAvatarUrl(member ?? {})}
        fallbackLetter={matchupOwnerFallbackInitial(member)}
        size={size}
        radius={0}
        alt=""
        variant="sidebar"
      />
    </span>
  );
}
