import type { MockLeagueFormat } from "@/lib/mockDraftEngine";

export type CpuPace = "fast" | "clock";

export type SavedMockDraft = {
  id: string;
  createdAt: string;
  /** Older saves recorded a league format. New drafts omit it; both formats draft the same. */
  format?: MockLeagueFormat;
  teamCount: number;
  /** 1-based round-1 slot. */
  userSlot: number;
  rosterSize: number;
  minFemale: number;
  minMale: number;
  clockSeconds: number;
  cpuPace: CpuPace;
  autopick: boolean;
  queue: string[];
  pickIds: (string | null)[];
  status: "drafting" | "complete";
};

const STORAGE_KEY = "draftastic.mockDrafts.v1";
const MAX_SAVED = 12;

function isFormat(value: unknown): value is MockLeagueFormat {
  return value === "head_to_head" || value === "season_overall";
}

function isSavedMockDraft(value: unknown): value is SavedMockDraft {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SavedMockDraft>;
  if (typeof row.id !== "string" || typeof row.createdAt !== "string") return false;
  if (row.format != null && !isFormat(row.format)) return false;
  if (typeof row.teamCount !== "number" || typeof row.userSlot !== "number") return false;
  if (typeof row.rosterSize !== "number" || typeof row.minFemale !== "number" || typeof row.minMale !== "number") {
    return false;
  }
  if (typeof row.clockSeconds !== "number") return false;
  if (row.cpuPace !== "fast" && row.cpuPace !== "clock") return false;
  if (typeof row.autopick !== "boolean") return false;
  if (!Array.isArray(row.queue) || !row.queue.every((id) => typeof id === "string")) return false;
  if (!Array.isArray(row.pickIds)) return false;
  if (row.pickIds.length !== row.teamCount * row.rosterSize) return false;
  if (!row.pickIds.every((id) => id == null || typeof id === "string")) return false;
  if (row.status !== "drafting" && row.status !== "complete") return false;
  if (row.userSlot < 1 || row.userSlot > row.teamCount) return false;
  return true;
}

export function readMockDrafts(): SavedMockDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedMockDraft).slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function writeMockDrafts(drafts: SavedMockDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(0, MAX_SAVED)));
}

export function upsertMockDraft(drafts: SavedMockDraft[], draft: SavedMockDraft): SavedMockDraft[] {
  return [draft, ...drafts.filter((row) => row.id !== draft.id)].slice(0, MAX_SAVED);
}
