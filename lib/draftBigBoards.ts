import { AUTOPICK_REQUIRED_PRIORITY_COUNT } from "@/lib/draftPriorityRequirements";

/**
 * Pre-built priority lists (“Big Boards”) managers can pick instead of ranking 50 wrestlers manually.
 * Replace each `wrestlerIds` array with exactly {@link AUTOPICK_REQUIRED_PRIORITY_COUNT}+ IDs in draft order
 * (at least 16 female per autopick rules — validated at draft time).
 */
export const BIG_BOARD_IDS = ["default", "dillster", "km_punk", "kayfabe_king"] as const;
export type BigBoardId = (typeof BIG_BOARD_IDS)[number];

export const DRAFT_BIG_BOARDS: Record<
  BigBoardId,
  { label: string; description: string; wrestlerIds: readonly string[] }
> = {
  default: {
    label: "Default Big Board",
    description: "Ranked by all-time total fantasy points (same roster rules as other boards).",
    wrestlerIds: [
      "cody-rhodes",
      "jey-uso",
      "cm-punk",
      "tiffany-stratton",
      "seth-rollins",
      "rhea-ripley",
      "dominik-mysterio",
      "iyo-sky",
      "gunther",
      "stephanie-vaquer",
      "sami-zayn",
      "drew-mcintyre",
      "logan-paul",
      "becky-lynch",
      "bron-breakker",
      "alexa-bliss",
      "jade-cargill",
      "la-knight",
      "penta",
      "charlotte-flair",
      "jacob-fatu",
      "randy-orton",
      "lyra-valkyria",
      "solo-sikoa",
      "raquel-rodriguez",
      "roman-reigns",
      "carmelo-hayes",
      "liv-morgan",
      "damian-priest",
      "jimmy-uso",
      "giulia",
      "roxanne-perez",
      "rey-fenix",
      "oba-femi",
      "trick-williams",
      "asuka",
      "dragon-lee",
      "jevon-evans",
      "nia-jax",
      "royce-keys",
      "kiana-james",
      "ilja-dragunov",
      "finn-balor",
      "lash-legend",
      "bayley",
      "bianca-belair",
      "aj-lee",
      "kairi-sane",
      "zelina-vega",
      "tama-tonga",
    ],
  },
  dillster: {
    label: "Dillster's Big Board",
    description: "Curated by Dillster — top 50 in ranked order.",
    wrestlerIds: [
      "cody-rhodes",
      "rhea-ripley",
      "cm-punk",
      "oba-femi",
      "seth-rollins",
      "stephanie-vaquer",
      "randy-orton",
      "penta",
      "liv-morgan",
      "jey-uso",
      "tiffany-stratton",
      "gunther",
      "trick-williams",
      "bron-breakker",
      "drew-mcintyre",
      "iyo-sky",
      "roman-reigns",
      "carmelo-hayes",
      "logan-paul",
      "becky-lynch",
      "sami-zayn",
      "jade-cargill",
      "jacob-fatu",
      "jevon-evans",
      "dominik-mysterio",
      "giulia",
      "charlotte-flair",
      "la-knight",
      "raquel-rodriguez",
      "alexa-bliss",
      "lash-legend",
      "damian-priest",
      "solo-sikoa",
      "lyra-valkyria",
      "nia-jax",
      "aj-lee",
      "austin-theory",
      "jimmy-uso",
      "finn-balor",
      "ilja-dragunov",
      "kiana-james",
      "r-truth",
      "roxanne-perez",
      "brock-lesnar",
      "bayley",
      "asuka",
      "rusev",
      "el-grande-americano",
      "kairi-sane",
      "aleister-black",
    ],
  },
  km_punk: {
    label: "KM Punk's Big Board",
    description: "Curated by KM Punk — top 50 in ranked order.",
    wrestlerIds: [
      "cody-rhodes",
      "cm-punk",
      "rhea-ripley",
      "randy-orton",
      "liv-morgan",
      "stephanie-vaquer",
      "trick-williams",
      "jevon-evans",
      "penta",
      "jey-uso",
      "roman-reigns",
      "lash-legend",
      "alexa-bliss",
      "charlotte-flair",
      "giulia",
      "oba-femi",
      "seth-rollins",
      "gunther",
      "becky-lynch",
      "la-knight",
      "iyo-sky",
      "jacob-fatu",
      "nia-jax",
      "drew-mcintyre",
      "jimmy-uso",
      "roxanne-perez",
      "raquel-rodriguez",
      "dominik-mysterio",
      "dragon-lee",
      "logan-paul",
      "carmelo-hayes",
      "austin-theory",
      "kairi-sane",
      "asuka",
      "solo-sikoa",
      "damian-priest",
      "tiffany-stratton",
      "jade-cargill",
      "kiana-james",
      "r-truth",
      "tama-tonga",
      "aleister-black",
      "bayley",
      "ilja-dragunov",
      "finn-balor",
      "chad-gable",
      "ludwig-kaiser",
      "rusev",
      "jd-mcdonagh",
      "royce-keys",
    ],
  },
  kayfabe_king: {
    label: "Kayfabe King's Big Board",
    description: "Curated by Kayfabe King — top 50 in ranked order.",
    wrestlerIds: [
      "randy-orton",
      "rhea-ripley",
      "cody-rhodes",
      "cm-punk",
      "stephanie-vaquer",
      "penta",
      "jey-uso",
      "liv-morgan",
      "oba-femi",
      "trick-williams",
      "iyo-sky",
      "gunther",
      "bron-breakker",
      "tiffany-stratton",
      "dominik-mysterio",
      "jacob-fatu",
      "roman-reigns",
      "drew-mcintyre",
      "becky-lynch",
      "jevon-evans",
      "charlotte-flair",
      "sami-zayn",
      "la-knight",
      "logan-paul",
      "carmelo-hayes",
      "alexa-bliss",
      "ilja-dragunov",
      "tama-tonga",
      "austin-theory",
      "damian-priest",
      "r-truth",
      "solo-sikoa",
      "raquel-rodriguez",
      "lash-legend",
      "jimmy-uso",
      "asuka",
      "brock-lesnar",
      "el-grande-americano",
      "giulia",
      "aj-lee",
      "aleister-black",
      "dragon-lee",
      "original-el-grande-americano",
      "lyra-valkyria",
      "kairi-sane",
      "roxanne-perez",
      "finn-balor",
      "royce-keys",
      "rusev",
      "bayley",
    ],
  },
};

export function isBigBoardId(value: string | null | undefined): value is BigBoardId {
  return value != null && (BIG_BOARD_IDS as readonly string[]).includes(value);
}

/** Returns a mutable copy of the board’s IDs, or null if unknown / not configured. */
export function getBigBoardPriorityList(boardId: string | null | undefined): string[] | null {
  if (!isBigBoardId(boardId)) return null;
  const ids = DRAFT_BIG_BOARDS[boardId].wrestlerIds;
  if (!ids.length || ids.length < AUTOPICK_REQUIRED_PRIORITY_COUNT) return null;
  return [...ids];
}

export function bigBoardLabel(boardId: BigBoardId): string {
  return DRAFT_BIG_BOARDS[boardId].label;
}

/**
 * If the saved priority list exactly matches a Big Board (order + ids, case-insensitive), return that board id.
 * Used when `priorityListSource` was not stored (legacy rows).
 */
export function inferListSourceFromSavedList(priorityList: string[]): BigBoardId | null {
  if (priorityList.length < AUTOPICK_REQUIRED_PRIORITY_COUNT) return null;
  const norm = (s: string) => String(s).trim().toLowerCase();
  for (const boardId of BIG_BOARD_IDS) {
    const boardList = DRAFT_BIG_BOARDS[boardId].wrestlerIds;
    if (boardList.length !== priorityList.length) continue;
    let match = true;
    for (let i = 0; i < priorityList.length; i++) {
      if (norm(boardList[i]!) !== norm(priorityList[i]!)) {
        match = false;
        break;
      }
    }
    if (match) return boardId;
  }
  return null;
}
