"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ManagerAvatar } from "@/app/components/ManagerAvatar";
import { ManagerAvatarPresetPicker } from "@/app/components/ManagerAvatarPresetPicker";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import { isAllowedManagerPresetUrl } from "@/lib/managerAvatarPresets";
import { updateLeagueManagerAvatarAction } from "./team/actions";

type Props = {
  leagueSlug: string;
  initialLeagueAvatarUrl: string | null;
  initialProfileAvatarUrl: string | null;
  fallbackLetter: string;
};

export function MyFactionAvatarEditor({
  leagueSlug,
  initialLeagueAvatarUrl,
  initialProfileAvatarUrl,
  fallbackLetter,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [leagueAvatarUrl, setLeagueAvatarUrl] = useState<string | null>(
    initialLeagueAvatarUrl?.trim() || null
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLeagueAvatarUrl(initialLeagueAvatarUrl?.trim() || null);
  }, [initialLeagueAvatarUrl]);

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
    if (ok) {
      setLeagueAvatarUrl(url);
      dialogRef.current?.close();
    }
    setBusy(false);
  };

  const onUseAccountDefault = async () => {
    setBusy(true);
    setMessage(null);
    const ok = await persist(null);
    if (ok) setLeagueAvatarUrl(null);
    setBusy(false);
  };

  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const pickerSelected =
    leagueAvatarUrl?.trim() && isAllowedManagerPresetUrl(leagueAvatarUrl.trim(), supabaseOrigin)
      ? leagueAvatarUrl.trim()
      : null;

  return (
    <div className="lm-myteam-avatar-block">
      <div
        className={`lm-myteam-avatar${previewUrl?.trim() ? " lm-myteam-avatar--image" : ""}`}
      >
        <ManagerAvatar
          avatarUrl={previewUrl}
          fallbackLetter={fallbackLetter}
          size={168}
          radius="var(--radius)"
          alt=""
          variant="sidebar"
        />
        <button
          type="button"
          className={`lm-myteam-avatar-edit${busy ? " lm-myteam-avatar-edit--busy" : ""}`}
          aria-label={busy ? "Saving…" : "Change avatar for this league"}
          disabled={busy}
          onClick={() => dialogRef.current?.showModal()}
        >
          <span className="lm-myteam-avatar-edit-chip">{busy ? "…" : "Edit"}</span>
        </button>
      </div>
      <dialog ref={dialogRef} className="lm-myteam-avatar-dialog">
        <h3 className="lm-myteam-avatar-dialog-title">Choose a manager avatar</h3>
        <ManagerAvatarPresetPicker
          selectedUrl={pickerSelected}
          onSelect={onPickPreset}
          disabled={busy}
          thumbSize={52}
          columns={4}
          maxHeightPx={320}
        />
        <div className="lm-myteam-avatar-dialog-actions">
          <button type="button" className="lm-myteam-avatar-dialog-close" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
      {leagueAvatarUrl ? (
        <button
          type="button"
          className="lm-myteam-avatar-use-default"
          disabled={busy}
          onClick={onUseAccountDefault}
        >
          Use account default
        </button>
      ) : null}
      {message ? (
        <p className="lm-myteam-avatar-msg" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
