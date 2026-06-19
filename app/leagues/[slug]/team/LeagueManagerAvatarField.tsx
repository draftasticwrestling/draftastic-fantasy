"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ManagerAvatarPresetPicker } from "@/app/components/ManagerAvatarPresetPicker";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import { isAllowedManagerPresetUrl } from "@/lib/managerAvatarPresets";
import { updateLeagueManagerAvatarAction } from "./actions";

type Props = {
  leagueSlug: string;
  /** league_members.manager_avatar_url only */
  initialLeagueAvatarUrl: string | null;
  /** profiles.avatar_url — fallback preview */
  initialProfileAvatarUrl: string | null;
  displayNameForInitial: string;
};

export function LeagueManagerAvatarField({
  leagueSlug,
  initialLeagueAvatarUrl,
  initialProfileAvatarUrl,
  displayNameForInitial,
}: Props) {
  const router = useRouter();
  const [leagueAvatarUrl, setLeagueAvatarUrl] = useState<string | null>(
    initialLeagueAvatarUrl?.trim() || null
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const previewUrl = resolvedManagerAvatarUrl({
    manager_avatar_url: leagueAvatarUrl,
    avatar_url: initialProfileAvatarUrl,
  });

  const persist = useCallback(
    async (url: string | null) => {
      const result = await updateLeagueManagerAvatarAction(leagueSlug, url);
      if (result.error) {
        setMessage(result.error);
        return false;
      }
      setMessage(null);
      router.refresh();
      return true;
    },
    [leagueSlug, router]
  );

  const onPickPreset = async ({ url }: { avatarId: string; url: string }) => {
    setBusy(true);
    setMessage(null);
    const ok = await persist(url);
    if (ok) setLeagueAvatarUrl(url);
    setBusy(false);
  };

  const onUseAccountDefault = async () => {
    setBusy(true);
    setMessage(null);
    const ok = await persist(null);
    if (ok) setLeagueAvatarUrl(null);
    setBusy(false);
  };

  const initial = (displayNameForInitial.trim().charAt(0) || "?").toUpperCase();
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const pickerSelected =
    leagueAvatarUrl?.trim() && isAllowedManagerPresetUrl(leagueAvatarUrl.trim(), supabaseOrigin)
      ? leagueAvatarUrl.trim()
      : null;

  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Manager avatar in this league</span>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
        Optional. Pick a different look for this league than on your account. If you use account default only, we use
        your{" "}
        <a href="/account" style={{ fontWeight: 600, color: "inherit" }}>
          Account
        </a>{" "}
        choice.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #ccc",
            background: "#f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 700,
            color: "#555",
            flexShrink: 0,
          }}
        >
          {previewUrl ? (
            <Image src={previewUrl} alt="" width={96} height={96} style={{ objectFit: "cover" }} />
          ) : (
            <span aria-hidden>{initial}</span>
          )}
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <ManagerAvatarPresetPicker
            selectedUrl={pickerSelected}
            onSelect={onPickPreset}
            disabled={busy}
            thumbSize={48}
            columns={4}
            maxHeightPx={360}
          />
          {leagueAvatarUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={onUseAccountDefault}
              style={{
                marginTop: 12,
                padding: "6px 12px",
                fontSize: 13,
                background: "transparent",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              Use account default only
            </button>
          ) : null}
        </div>
      </div>
      {message && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b91c1c" }}>{message}</p>
      )}
    </div>
  );
}
