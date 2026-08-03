import type { TitleHistoryItem } from "@/lib/championshipTitleHistory";
import { normalizeReignKind, type ChampionshipReignKind } from "@/lib/championshipReignKind";
import {
  collapseTagTeamChampionsForCard,
  type ChampionCardRow,
} from "@/lib/championshipCardTagChampions";

export type CurrentReignSplit = {
  /** All open reigns (lostDate null), newest first. */
  open: TitleHistoryItem[];
  interim: TitleHistoryItem[];
  inactiveInjured: TitleHistoryItem[];
  /** Open reigns that are neither interim nor inactive_injured (normal / tag / sole). */
  otherOpen: TitleHistoryItem[];
  hasInterim: boolean;
};

export function isOpenTitleHistoryItem(item: TitleHistoryItem): boolean {
  return item.lostDate == null || String(item.lostDate).trim() === "";
}

/** Split open reigns for championship card / hero display. */
export function splitCurrentReigns(items: TitleHistoryItem[]): CurrentReignSplit {
  const open = items
    .filter(isOpenTitleHistoryItem)
    .sort((a, b) => b.wonDate.localeCompare(a.wonDate));
  const interim = open.filter((i) => normalizeReignKind(i.reignKind) === "interim");
  const inactiveInjured = open.filter(
    (i) => normalizeReignKind(i.reignKind) === "inactive_injured"
  );
  const otherOpen = open.filter((i) => {
    const k = normalizeReignKind(i.reignKind);
    return k !== "interim" && k !== "inactive_injured";
  });
  return {
    open,
    interim,
    inactiveInjured,
    otherOpen,
    hasInterim: interim.length > 0,
  };
}

type CollapseCtx = Parameters<typeof collapseTagTeamChampionsForCard>[2];

/**
 * Build primary (prominent) and secondary (smaller) champion lists for cards/detail.
 * When an interim exists: interim is primary, inactive injured is secondary.
 * Otherwise: all open reigns (collapsed for tags) are primary.
 */
export function buildCurrentChampionDisplay(
  title: string,
  items: TitleHistoryItem[],
  ctx: CollapseCtx
): {
  primary: ChampionCardRow[];
  secondary: ChampionCardRow[];
  primaryLabel: string;
  secondaryLabel: string | null;
  tagTeamName: string | null;
  hasTeamNameRow: boolean;
  hasInterim: boolean;
  /** Meta line under primary (e.g. won date of interim / latest open). */
  primaryMetaItem: TitleHistoryItem | null;
} {
  const split = splitCurrentReigns(items);

  if (split.hasInterim) {
    const interimCollapsed = collapseTagTeamChampionsForCard(title, split.interim, ctx);
    const inactiveCollapsed = collapseTagTeamChampionsForCard(title, split.inactiveInjured, ctx);
    return {
      primary: interimCollapsed.champions,
      secondary: inactiveCollapsed.champions,
      primaryLabel: interimCollapsed.champions.length > 1 ? "Interim Champions" : "Interim Champion",
      secondaryLabel:
        inactiveCollapsed.champions.length > 0
          ? inactiveCollapsed.champions.length > 1
            ? "Champions (inactive)"
            : "Champion (inactive)"
          : null,
      tagTeamName: interimCollapsed.tagTeamName,
      hasTeamNameRow: interimCollapsed.hasTeamNameRow,
      hasInterim: true,
      primaryMetaItem: split.interim[0] ?? null,
    };
  }

  // Fallback when no open reigns: legacy "latest wonDate" co-holders.
  const source =
    split.open.length > 0
      ? split.open
      : (() => {
          const sorted = [...items].sort((a, b) => b.wonDate.localeCompare(a.wonDate));
          const latestWon = sorted[0]?.wonDate;
          return latestWon ? sorted.filter((x) => x.wonDate === latestWon) : [];
        })();

  const collapsed = collapseTagTeamChampionsForCard(title, source, ctx);
  return {
    primary: collapsed.champions,
    secondary: [],
    primaryLabel: collapsed.champions.length > 1 ? "Current champions" : "Current champion",
    secondaryLabel: null,
    tagTeamName: collapsed.tagTeamName,
    hasTeamNameRow: collapsed.hasTeamNameRow,
    hasInterim: false,
    primaryMetaItem: source[0] ?? null,
  };
}

export type { ChampionshipReignKind };
