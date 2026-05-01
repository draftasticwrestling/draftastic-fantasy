/**
 * Point tables for How it Works /points documentation.
 * Legacy League tab shows the full year; season tabs use subsets.
 * Rows are ordered by point value (highest → lowest); ties keep a sensible narrative order.
 */

import type { BeltKey } from "@/lib/howItWorksImages";

export const GENERAL_RULES = [
  "For a non–Royal Rumble battle royal, only battle royal points apply for that match (entry, eliminations, winner). The usual “on the card” and “winning your match” points for Raw, SmackDown, or a PLE do not stack on top — they are superseded so appearance is not counted twice.",
  "A standard match victory earns full points. If a victory occurs via disqualification (DQ) or any other disqualifying result, it is worth half points. A No Contest result only earns appearance points; no victory or title defense points are awarded.",
  "Additional main event points are awarded only if the match is not the PLE's featured (titled) match. Example: If the Men's Royal Rumble is the main event of the PLE, the winner receives only the standard event points, not extra for it being the main event.",
  "A successful title defense is worth an additional 4 points, regardless of the event or match placement. If the title is retained via disqualification, the bonus is reduced to 2 points (half points).",
  "An initial title win earns an additional 5 points, regardless of where or how it occurs.",
  "Points are awarded during the event.",
];

export const MENS_BELT_KEYS: BeltKey[] = [
  "undisputed-wwe",
  "heavyweight",
  "intercontinental-mens",
  "us-mens",
  "tag-team-mens",
];

export const TITLE_POINTS_MENS = [
  { name: "Undisputed WWE Champion", points: 12 },
  { name: "Heavy Weight Champion", points: 12 },
  { name: "Intercontinental Champion", points: 8 },
  { name: "US Champion", points: 8 },
  { name: "Tag Team Champion (Per Member)", points: 4 },
];

export const WOMENS_BELT_KEYS: BeltKey[] = [
  "wwe-womens",
  "womens-world",
  "intercontinental-womens",
  "us-womens",
  "tag-team-womens",
];

export const TITLE_POINTS_WOMENS = [
  { name: "WWE Women's Champion", points: 12 },
  { name: "Women's World Champion", points: 12 },
  { name: "Intercontinental Champion", points: 8 },
  { name: "US Champion", points: 8 },
  { name: "Tag Team Champion (Per Member)", points: 4 },
];

/** In-match bonuses; same for every championship (belt defense / new champion). */
export const BELT_DEFENSE_NEW_CHAMPION_POINTS: [string, number][] = [
  ["Initial title win (new champion)", 5],
  ["Successful title defense (champion retains)", 4],
  ["Title defense via disqualification (DQ)", 2],
];

/**
 * Standard battle royals on Raw, SmackDown, or a PLE undercard — not the Royal Rumble premium live event.
 * +1 appearance, +2 per elimination, +8 win (same as scoring engine).
 */
export const SPECIAL_MATCH_BATTLE_ROYAL_POINTS: [string, number][] = [
  ["Winning the Battle Royal", 8],
  ["Each elimination (per opponent removed)", 2],
  ["Entering the Battle Royal (appearance)", 1],
];

export const SPECIAL_MATCH_VICTORY_BONUS_BY_EVENT_TIER: [string, number][] = [
  ["Raw / SmackDown", 1],
  ["Minor / Medium PLE", 2],
  ["Major PLE", 3],
];

/** Raw and SmackDown base match-card scoring (Road to SummerSlam 2026 and Legacy). */
export const RAWSMACKDOWN_POINTS: [string, number][] = [
  ["Winning the main event", 4],
  ["Main eventing (appearance)", 3],
  ["Winning your match (non–main event)", 2],
  ["Being on the match card (non–main event)", 1],
];

export const WRESTLEMANIA_POINTS: [string, number][] = [
  ["Winning Main Event Night Two at Wrestlemania", 40],
  ["Main Eventing Night Two at Wrestlemania", 30],
  ["Winning Night One in Main Event at Wrestlemania", 30],
  ["Main Eventing Night One at Wrestlemania", 25],
  ["Winning Non-ME Match at Wrestlemania", 16],
  ["Being on the Non-ME Card at Wrestlemania", 8],
];

export const SUMMERSLAM_POINTS: [string, number][] = [
  ["Winning main event SummerSlam Night 2", 30],
  ["Main eventing SummerSlam Night 2 (appearance)", 30],
  ["Winning main event SummerSlam Night 1", 25],
  ["Main eventing SummerSlam Night 1 (appearance)", 20],
  ["Winning your match (non–main event)", 20],
  ["Being on the card (non–main event)", 10],
];

export const SURVIVOR_SERIES_POINTS: [string, number | string][] = [
  ["Winning the Main Event", 15],
  ["Winning War Games", 14],
  ["Main Eventing", 12],
  ["Winning Your Match", 10],
  ["Wrestler Who Makes the Pin", 10],
  ["Being on a War Games Team", 8],
  ["Being on the Non-ME Card", 5],
  ["Point Bonus for Entry Order", "1-5"],
];

export const ROYAL_RUMBLE_POINTS: [string, number][] = [
  ["Winning the Royal Rumble", 30],
  ["Winning the Main Event", 15],
  ["Iron Man/Iron Woman", 12],
  ["Person Who Eliminates the Most", 12],
  ["Main Eventing", 12],
  ["Winning Your Match", 10],
  ["Being on the Non-ME Card", 5],
  ["Points for Each Person Eliminated", 3],
  ["Being in the Royal Rumble", 2],
];

export const ELIMINATION_CHAMBER_POINTS: [string, number][] = [
  ["Winning the Elimination Chamber", 30],
  ["Longest Lasting Participant in the Chamber", 15],
  ["Winning the Main Event", 15],
  ["Qualifying for the Elimination Chamber", 10],
  ["Eliminating an Opponent in the Chamber", 10],
  ["Main Eventing", 9],
  ["Winning Your Match", 8],
  ["Being on the Match Card (non-main event)", 4],
];

export const NOC_POINTS: [string, number][] = [
  ["Winning the main event", 16],
  ["Main eventing (appearance)", 12],
  ["Winning your match", 10],
  ["Being on the card (non–main event)", 5],
];

export const MITB_POINTS: [string, number][] = [
  ["Money in the Bank Winner", 25],
  ["Winning the Main Event", 15],
  ["Earning a Spot in the Ladder Match", 12],
  ["Main Eventing", 9],
  ["Winning Your Match", 8],
  ["Being on the Match Card (non-main event)", 4],
];

export const CROWN_JEWEL_POINTS: [string, number][] = [
  ["Winning the Crown Jewel Championship", 20],
  ["Winning the Main Event (non CJ Championship)", 15],
  ["Crown Jewel Championship", 10],
  ["Main Eventing (non CJ Championship)", 9],
  ["Winning Your Match", 8],
  ["Being on the Match Card (non-main event)", 4],
];

export const KING_QUEEN_POINTS: [string, number][] = [
  ["King or Queen of the Ring", 20],
  ["Finals Qualification", 10],
  ["Semi-Finals Qualification (in addition to Raw/Smackdown match points)", 7],
  ["First Round Qualification (in addition to Raw/Smackdown match points)", 3],
];

export const MINOR_PLE_BASE_POINTS: [string, number][] = [
  ["Winning the main event", 12],
  ["Main eventing (appearance)", 9],
  ["Winning your match", 6],
  ["Being on the card (non–main event)", 3],
];

/**
 * Per-roster-wrestler appearance floor for the league RTS PLE “anticipated points” grid
 * (non–main-event on-card row in How it Works / same tables as live scoring).
 */
export function rtsPleAnticipatedAppearanceFloorPts(plePathKey: string): number {
  const minorCard =
    MINOR_PLE_BASE_POINTS.find(([label]) => label.includes("Being on the card"))?.[1] ?? 3;
  const nocCard = NOC_POINTS.find(([label]) => label.includes("Being on the card"))?.[1] ?? 5;
  const summerslamCard =
    SUMMERSLAM_POINTS.find(([label]) => label.includes("Being on the card"))?.[1] ?? 10;
  switch (plePathKey) {
    case "backlash":
    case "snme-1":
    case "snme-2":
    case "clash-in-italy":
      return minorCard;
    case "night-of-champions":
      return nocCard;
    case "summerslam":
      return summerslamCard;
    default:
      return minorCard;
  }
}

export const EVOLUTION_EXTRA_POINTS: [string, number][] = [
  ["Winning the Battle Royal", 8],
  ["Each elimination (per opponent removed)", 2],
  ["Entering the Battle Royal (appearance)", 1],
];
