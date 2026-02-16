/**
 * Return type of scoreEvent() from lib/scoring/scoreEvent.js
 * Use when calling scoreEvent from TypeScript so the result is typed.
 */
export type ScoredMatch = {
  order?: number;
  isPromo?: boolean;
  title?: string;
  titleOutcome?: string;
  participants?: string | string[];
  result?: string;
  method?: string;
  wrestlerPoints?: Array<{ wrestler: string; total?: number; breakdown?: string[]; [key: string]: unknown }>;
  [key: string]: unknown;
};

export type ScoredEvent = {
  eventId?: string;
  eventName?: string;
  eventType?: string;
  date?: string;
  matches: ScoredMatch[];
};
