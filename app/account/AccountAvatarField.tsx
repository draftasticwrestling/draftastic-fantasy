"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ManagerAvatarPresetPicker } from "@/app/components/ManagerAvatarPresetPicker";
import { isAllowedManagerPresetUrl, resolveManagerPresetDisplayUrl } from "@/lib/managerAvatarPresets";

type Props = {
  initialAvatarUrl: string | null;
  displayNameForInitial: string;
};

export function AccountAvatarField({ initialAvatarUrl, displayNameForInitial }: Props) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl?.trim() || null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl?.trim() || null);
  }, [initialAvatarUrl]);

  const saveAvatarUrl = useCallback(
    async (url: string | null) => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data as { error?: string }).error ?? "Could not save avatar.");
        return false;
      }
      setMessage(null);
      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("draftastic-profile-updated"));
      }
      return true;
    },
    [router]
  );

  const onPickPreset = async (url: string) => {
    setBusy(true);
    setMessage(null);
    const ok = await saveAvatarUrl(url);
    if (ok) setAvatarUrl(url);
    setBusy(false);
  };

  const onRemove = async () => {
    setBusy(true);
    setMessage(null);
    const ok = await saveAvatarUrl(null);
    if (ok) setAvatarUrl(null);
    setBusy(false);
  };

  const initial = (displayNameForInitial.trim().charAt(0) || "?").toUpperCase();
  const previewSrc = avatarUrl?.trim() ? resolveManagerPresetDisplayUrl(avatarUrl.trim()) : null;
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const pickerSelected =
    previewSrc && isAllowedManagerPresetUrl(previewSrc, supabaseOrigin) ? previewSrc : null;

  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Manager avatar</span>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
        Choose a default manager photo for leagues where you haven&apos;t set a league-specific avatar (set per league
        under <strong>Edit Faction</strong> in that league).
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
          {previewSrc ? (
            <Image src={previewSrc} alt="" width={96} height={96} style={{ objectFit: "cover" }} />
          ) : (
            <span aria-hidden>{initial}</span>
          )}
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <ManagerAvatarPresetPicker
            selectedUrl={pickerSelected}
            onSelect={onPickPreset}
            disabled={busy}
            thumbSize={48}
            columns={4}
            maxHeightPx={360}
          />
          {previewSrc ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
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
              Remove avatar
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
