"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MANAGER_AVATARS_BUCKET } from "@/lib/managerAvatarBucket";
import {
  isPresetObjectPath,
  managerAvatarPresetPublicUrl,
  presetFilenameToLabel,
} from "@/lib/managerAvatarPresets";

type PresetItem = { objectPath: string; url: string; label: string };

function urlsEqual(a: string | null | undefined, b: string): boolean {
  if (!a?.trim()) return false;
  try {
    return new URL(a.trim()).href === new URL(b.trim()).href;
  } catch {
    return a.trim() === b.trim();
  }
}

type Props = {
  selectedUrl: string | null;
  onSelect: (publicUrl: string) => void;
  disabled?: boolean;
  /** Thumbnail size in px */
  thumbSize?: number;
  /** Max columns in grid */
  columns?: number;
  /** Scroll tall grids (e.g. dialog) */
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
  const [items, setItems] = useState<PresetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const supabase = createClient();
        const listOpts = {
          limit: 200,
          sortBy: { column: "name" as const, order: "asc" as const },
        };
        const [presetsRes, rootRes] = await Promise.all([
          supabase.storage.from(MANAGER_AVATARS_BUCKET).list("presets", listOpts),
          supabase.storage.from(MANAGER_AVATARS_BUCKET).list("", listOpts),
        ]);
        if (cancelled) return;

        if (presetsRes.error && rootRes.error) {
          setLoadError(
            presetsRes.error.message || rootRes.error.message || "Could not load avatar list."
          );
          setItems([]);
          return;
        }

        const byUrl = new Map<string, PresetItem>();

        if (!presetsRes.error && presetsRes.data) {
          for (const row of presetsRes.data) {
            if (row.metadata == null || !row.name) continue;
            const objectPath = `presets/${row.name}`;
            if (!isPresetObjectPath(objectPath)) continue;
            const url = managerAvatarPresetPublicUrl(objectPath);
            byUrl.set(url, {
              objectPath,
              url,
              label: presetFilenameToLabel(row.name),
            });
          }
        }

        if (!rootRes.error && rootRes.data) {
          for (const row of rootRes.data) {
            if (row.metadata == null || !row.name) continue;
            if (!isPresetObjectPath(row.name)) continue;
            const objectPath = row.name;
            const url = managerAvatarPresetPublicUrl(objectPath);
            byUrl.set(url, {
              objectPath,
              url,
              label: presetFilenameToLabel(row.name),
            });
          }
        }

        const next = [...byUrl.values()].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
        );
        setItems(next);
      } catch {
        if (!cancelled) {
          setLoadError("Could not load avatar list.");
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
        No slug-named images found. Add files to the <code>manager-avatars</code> bucket (at the bucket root or under{" "}
        <code>presets/</code>), using names like <code>stone-cold.png</code>.
      </p>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Choose a manager avatar"
      style={gridStyle}
    >
      {items.map(({ objectPath, url, label }) => {
        const isSelected = urlsEqual(selectedUrl, url);
        return (
          <button
            key={objectPath}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onSelect(url)}
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
