import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

export type WrestlerAutolinkEntry = {
  id: string;
  /** Preferred link label (usually `name`, else `id`). */
  display: string;
};

const MIN_DISPLAY_LEN = 3;

/**
 * Load active wrestlers for name → profile autolinking in article Markdown.
 * Mirrors /api/wrestlers filters when possible.
 */
export async function fetchWrestlerAutolinkEntries(
  supabase: SupabaseClient
): Promise<WrestlerAutolinkEntry[]> {
  let result = await supabase
    .from("wrestlers")
    .select("id, name")
    .or("status.is.null,status.neq.Inactive")
    .order("name", { ascending: true });
  if (result.error) {
    result = await supabase.from("wrestlers").select("id, name").order("name", { ascending: true });
  }
  const rows = result.data ?? [];
  const byNorm = new Map<string, WrestlerAutolinkEntry>();
  for (const r of rows) {
    const id = String(r.id ?? "").trim();
    if (!id) continue;
    const display = String(r.name ?? "").trim() || id;
    if (display.length < MIN_DISPLAY_LEN) continue;
    const key = display.toLowerCase();
    const prev = byNorm.get(key);
    if (!prev || display.length > prev.display.length) {
      byNorm.set(key, { id, display });
    }
  }
  return [...byNorm.values()].sort((a, b) => b.display.length - a.display.length);
}

/** One query per request when used from multiple article bodies on the same page. */
export const getCachedWrestlerAutolinkEntries = cache(async () => {
  const supabase = await createClient();
  return fetchWrestlerAutolinkEntries(supabase);
});

/** Map curly/smart quotes to ASCII `'` for name equality (Je'Von in copy vs DB). */
function normalizeAutolinkApostrophes(s: string): string {
  return s.replace(/[\u2018\u2019\u201A\u201B\u2032\u0060]/g, "'");
}

function isWordChar(c: string): boolean {
  if (/[A-Za-z0-9'.\-]/.test(c)) return true;
  const cp = c.codePointAt(0);
  return cp === 0x2018 || cp === 0x2019 || cp === 0x201a || cp === 0x201b || cp === 0x2032;
}

function isBoundaryBefore(text: string, start: number): boolean {
  if (start <= 0) return true;
  return !isWordChar(text[start - 1]!);
}

function isBoundaryAfter(text: string, end: number): boolean {
  if (end >= text.length) return true;
  const c = text[end]!;
  const next = text[end + 1];
  if ((c === "'" || c === "\u2019" || c === "\u2018") && (next === "s" || next === "S")) {
    return true;
  }
  return !isWordChar(c);
}

/** Case-insensitive match of `display` at `text[start]`. Returns matched length or 0. */
function matchDisplayAt(text: string, start: number, display: string): number {
  if (display.length === 0 || start + display.length > text.length) return 0;
  if (!isBoundaryBefore(text, start)) return 0;
  const slice = text.slice(start, start + display.length);
  const a = normalizeAutolinkApostrophes(slice).toLowerCase();
  const b = normalizeAutolinkApostrophes(display).toLowerCase();
  if (a !== b) return 0;
  if (!isBoundaryAfter(text, start + display.length)) return 0;
  return display.length;
}

/**
 * Replace wrestler display names with Markdown links. Longest names win at each position.
 */
export function replaceWrestlerNamesInPlainText(
  text: string,
  entries: WrestlerAutolinkEntry[]
): string {
  if (!text || entries.length === 0) return text;
  let out = "";
  let i = 0;
  while (i < text.length) {
    let matchedLen = 0;
    let entry: WrestlerAutolinkEntry | null = null;
    for (const e of entries) {
      const len = matchDisplayAt(text, i, e.display);
      if (len > matchedLen) {
        matchedLen = len;
        entry = e;
      }
    }
    if (entry && matchedLen > 0) {
      const raw = text.slice(i, i + matchedLen);
      const slugFromName = normalizeWrestlerName(entry.display);
      const pathSegment = slugFromName || entry.id;
      const href = `/wrestlers/${encodeURIComponent(pathSegment)}`;
      out += `[${raw}](${href})`;
      i += matchedLen;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

type Chunk = { protect: boolean; value: string };

/**
 * Split Markdown into protected (code, links, images) vs plain segments.
 */
export function splitMarkdownForWrestlerAutolink(md: string): Chunk[] {
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < md.length) {
    if (md.startsWith("```", i)) {
      const end = md.indexOf("```", i + 3);
      if (end < 0) {
        chunks.push({ protect: true, value: md.slice(i) });
        break;
      }
      chunks.push({ protect: true, value: md.slice(i, end + 3) });
      i = end + 3;
      continue;
    }
    if (md[i] === "`") {
      const end = md.indexOf("`", i + 1);
      if (end < 0) {
        chunks.push({ protect: false, value: md.slice(i) });
        break;
      }
      chunks.push({ protect: true, value: md.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    if (md.startsWith("![", i)) {
      const mid = md.indexOf("](", i);
      if (mid < 0) {
        chunks.push({ protect: false, value: md.slice(i) });
        break;
      }
      const close = md.indexOf(")", mid + 2);
      if (close < 0) {
        chunks.push({ protect: false, value: md.slice(i) });
        break;
      }
      chunks.push({ protect: true, value: md.slice(i, close + 1) });
      i = close + 1;
      continue;
    }
    if (md[i] === "[") {
      const closeBracket = md.indexOf("]", i);
      if (closeBracket > i && md[closeBracket + 1] === "(") {
        const closeParen = md.indexOf(")", closeBracket + 2);
        if (closeParen > closeBracket) {
          chunks.push({ protect: true, value: md.slice(i, closeParen + 1) });
          i = closeParen + 1;
          continue;
        }
      }
    }
    let j = i;
    while (j < md.length) {
      const c = md[j];
      if (c === "`" || c === "[" || md.startsWith("```", j)) break;
      j++;
    }
    if (j > i) chunks.push({ protect: false, value: md.slice(i, j) });
    i = j === i ? i + 1 : j;
  }
  return chunks;
}

export function autolinkWrestlersInMarkdown(
  markdown: string,
  entries: WrestlerAutolinkEntry[]
): string {
  if (!markdown?.trim() || entries.length === 0) return markdown;
  return splitMarkdownForWrestlerAutolink(markdown)
    .map((ch) => (ch.protect ? ch.value : replaceWrestlerNamesInPlainText(ch.value, entries)))
    .join("");
}
