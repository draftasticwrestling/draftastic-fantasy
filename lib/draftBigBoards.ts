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
    description: "Updated 4/26/26. Ranked by current default draft preference order.",
    wrestlerIds: [
      "cody-rhodes",
      "jey-uso",
      "cm-punk",
      "rhea-ripley",
      "tiffany-stratton",
      "seth-rollins",
      "dominik-mysterio",
      "gunther",
      "becky-lynch",
      "iyo-sky",
      "stephanie-vaquer",
      "la-knight",
      "roman-reigns",
      "drew-mcintyre",
      "logan-paul",
      "sami-zayn",
      "penta",
      "alexa-bliss",
      "jade-cargill",
      "bron-breakker",
      "charlotte-flair",
      "jacob-fatu",
      "randy-orton",
      "lyra-valkyria",
      "solo-sikoa",
      "raquel-rodriguez",
      "damian-priest",
      "jimmy-uso",
      "carmelo-hayes",
      "dragon-lee",
      "finn-balor",
      "rey-fenix",
      "giulia",
      "roxanne-perez",
      "nia-jax",
      "asuka",
      "montez-ford",
      "angelo-dawkins",
      "ilja-dragunov",
      "lash-legend",
      "bayley",
      "jevon-evans",
      "trick-williams",
      "oba-femi",
      "johnny-gargano",
      "erik",
      "jd-mcdonagh",
      "rey-mysterio",
      "tama-tonga",
      "rusev",
    ],
  },
  dillster: {
    label: "Dillster's Big Board",
    description: "Curated by Dillster — top 50 in ranked order.",
    wrestlerIds: [
      "cody-rhodes",
      "rhea-ripley",
      "roman-reigns",
      "oba-femi",
      "cm-punk",
      "bron-breakker",
      "liv-morgan",
      "seth-rollins",
      "stephanie-vaquer",
      "jey-uso",
      "penta",
      "tiffany-stratton",
      "gunther",
      "trick-williams",
      "jacob-fatu",
      "randy-orton",
      "iyo-sky",
      "carmelo-hayes",
      "logan-paul",
      "becky-lynch",
      "la-knight",
      "jevon-evans",
      "sami-zayn",
      "finn-balor",
      "sol-ruca",
      "dominik-mysterio",
      "jade-cargill",
      "giulia",
      "charlotte-flair",
      "ricky-saints",
      "drew-mcintyre",
      "ethan-page",
      "raquel-rodriguez",
      "alexa-bliss",
      "damian-priest",
      "solo-sikoa",
      "jacy-jayne",
      "lyra-valkyria",
      "joe-hendry",
      "roxanne-perez",
      "lash-legend",
      "royce-keys",
      "jimmy-uso",
      "austin-theory",
      "ilja-dragunov",
      "paige",
      "asuka",
      "montez-ford",
      "angelo-dawkins",
      "rusev",
    ],
  },
  km_punk: {
    label: "KM Punk's Big Board",
    description: "Curated by KM Punk — top 50 in ranked order.",
    wrestlerIds: [
      "cody-rhodes",
      "roman-reigns",
      "rhea-ripley",
      "oba-femi",
      "liv-morgan",
      "iyo-sky",
      "trick-williams",
      "jevon-evans",
      "cm-punk",
      "tiffany-stratton",
      "becky-lynch",
      "sol-ruca",
      "stephanie-vaquer",
      "paige",
      "penta",
      "seth-rollins",
      "gunther",
      "jacob-fatu",
      "logan-paul",
      "austin-theory",
      "charlotte-flair",
      "alexa-bliss",
      "dominik-mysterio",
      "carmelo-hayes",
      "jey-uso",
      "randy-orton",
      "lash-legend",
      "jade-cargill",
      "la-knight",
      "giulia",
      "roxanne-perez",
      "joe-hendry",
      "raquel-rodriguez",
      "solo-sikoa",
      "lyra-valkyria",
      "damian-priest",
      "r-truth",
      "brie-bella",
      "finn-balor",
      "chad-gable",
      "royce-keys",
      "jimmy-uso",
      "montez-ford",
      "jacy-jayne",
      "rusev",
      "dragon-lee",
      "jordynne-grace",
      "bayley",
      "ilja-dragunov",
      "tama-tonga",
    ],
  },
  kayfabe_king: {
    label: "Kayfabe King's Big Board",
    description: "Curated by Kayfabe King — top 50 in ranked order.",
    wrestlerIds: [
      "cody-rhodes",
      "roman-reigns",
      "rhea-ripley",
      "jey-uso",
      "cm-punk",
      "oba-femi",
      "tiffany-stratton",
      "seth-rollins",
      "jacob-fatu",
      "dominik-mysterio",
      "gunther",
      "becky-lynch",
      "iyo-sky",
      "stephanie-vaquer",
      "bron-breakker",
      "la-knight",
      "trick-williams",
      "randy-orton",
      "penta",
      "logan-paul",
      "jevon-evans",
      "sami-zayn",
      "liv-morgan",
      "carmelo-hayes",
      "alexa-bliss",
      "drew-mcintyre",
      "jade-cargill",
      "charlotte-flair",
      "paige",
      "lyra-valkyria",
      "solo-sikoa",
      "raquel-rodriguez",
      "ilja-dragunov",
      "lash-legend",
      "ethan-page",
      "jimmy-uso",
      "damian-priest",
      "austin-theory",
      "ricky-saints",
      "r-truth",
      "jacy-jayne",
      "giulia",
      "roxanne-perez",
      "nia-jax",
      "asuka",
      "sol-ruca",
      "montez-ford",
      "royce-keys",
      "joe-hendry",
      "brie-bella",
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
