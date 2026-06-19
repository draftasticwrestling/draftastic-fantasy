"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { resolveManagerPresetDisplayUrl } from "@/lib/managerAvatarPresets";

export type ManagerAvatarPickerSelection = {
  avatarId: string;
  url: string;
  label: string;
};

type ApiAvatar = {
  id: string;
  label: string;
  display_url: string;
  pack_slug: string;
};

type CatalogItem = ManagerAvatarPickerSelection & {
  pack_slug: string;
};

function urlsEqual(a: string | null | undefined, b: string): boolean {
  if (!a?.trim()) return false;
  try {
    const ha = new URL(resolveManagerPresetDisplayUrl(a.trim())).href;
    const hb = new URL(resolveManagerPresetDisplayUrl(b.trim())).href;
    return ha === hb;
  } catch {
    return resolveManagerPresetDisplayUrl(a.trim()) === resolveManagerPresetDisplayUrl(b.trim());
  }
}

type Props = {
  selectedUrl: string | null;
  onSelect: (selection: ManagerAvatarPickerSelection) => void;
  disabled?: boolean;
  thumbSize?: number;
  columns?: number;
  maxHeightPx?: number;
};

export function ManagerAvatarPresetPicker({
  selectedUrl,
  onSelect,
  disabled,
  thumbSize = 56,
  columns = 4,
  maxHeightPx,
}: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/avatars/available");
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          avatars?: ApiAvatar[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error ?? "Could not load avatars.");
          setItems([]);
          return;
        }
        setItems(
          (data.avatars ?? []).map((a) => ({
            avatarId: a.id,
            url: a.display_url,
            label: a.label,
            pack_slug: a.pack_slug,
          }))
        );
      } catch {
        if (!cancelled) {
          setLoadError("Could not load avatars.");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const gridStyle = useMemo(
    () =>
      ({
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 10,
        maxWidth: columns * (thumbSize + 10),
        ...(maxHeightPx != null
          ? { maxHeight: maxHeightPx, overflowY: "auto" as const, paddingRight: 4 }
          : {}),
      }) as const,
    [columns, thumbSize, maxHeightPx]
  );

  if (loading) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: "#666" }} aria-live="polite">
        Loading avatars…
      </p>
    );
  }

  if (loadError) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }} role="alert">
        {loadError}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
        No avatars available in your unlocked packs yet.
      </p>
    );
  }

  return (
    <div role="listbox" aria-label="Choose a manager avatar" style={gridStyle}>
      {items.map(({ avatarId, url, label }) => {
        const isSelected = urlsEqual(selectedUrl, url);
        return (
          <button
            key={avatarId}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onSelect({ avatarId, url, label })}
            style={{
              position: "relative",
              width: thumbSize,
              height: thumbSize,
              padding: 0,
              borderRadius: 10,
              border: isSelected ? "2px solid #1a73e8" : "2px solid #ddd",
              overflow: "hidden",
              cursor: disabled ? "wait" : "pointer",
              background: "#f0f0f0",
              boxSizing: "border-box",
            }}
          >
            <Image src={url} alt="" width={thumbSize} height={thumbSize} style={{ objectFit: "cover" }} />
          </button>
        );
      })}
    </div>
  );
}
