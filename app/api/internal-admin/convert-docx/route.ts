import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";
import mammoth from "mammoth";

import { getSiteAdminForApi } from "@/lib/auth/siteAdmin";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

type MammothMsg = { message?: string };
type MammothResult = { value?: string; messages?: MammothMsg[] };

function collectMessages(msgs: MammothMsg[] | undefined): string[] {
  return (msgs ?? []).map((m) => m.message).filter((s): s is string => Boolean(s));
}

/** When Markdown output is empty, HTML conversion often still has body text (esp. some Google Docs exports). */
function htmlToFallbackPlain(html: string): string {
  const dec = html
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return dec.trim();
}

/**
 * POST multipart form: field `file` = .docx
 * Converts on the server so the admin browser tab never runs mammoth on the main thread.
 */
export async function POST(request: Request) {
  const auth = await getSiteAdminForApi();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Use multipart form data with field name “file”." },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing “file” field." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (${Math.round(file.size / 1024 / 1024)} MB). Max ${MAX_BYTES / 1024 / 1024} MB.`,
      },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Only .docx is supported." }, { status: 400 });
  }

  try {
    // Node mammoth uses `buffer` or `path`, not `arrayBuffer` (browser-only). See mammoth/lib/unzip.js.
    const buffer = Buffer.from(await file.arrayBuffer());
    const m = mammoth as typeof mammoth & {
      convertToMarkdown: (input: { buffer: Buffer }) => Promise<MammothResult>;
      extractRawText: (input: { buffer: Buffer }) => Promise<MammothResult>;
      convertToHtml: (input: { buffer: Buffer }) => Promise<MammothResult>;
    };

    const allMessages: string[] = [];

    const mdConv = await m.convertToMarkdown({ buffer });
    allMessages.push(...collectMessages(mdConv.messages));
    let markdown = (mdConv.value ?? "").trim();
    let fallback: "raw" | "html" | null = null;

    // Google Docs / Word sometimes produce empty Markdown even when body text exists.
    if (!markdown) {
      const rawConv = await m.extractRawText({ buffer });
      allMessages.push(...collectMessages(rawConv.messages));
      markdown = (rawConv.value ?? "").trim();
      if (markdown) fallback = "raw";
    }

    if (!markdown) {
      const htmlConv = await m.convertToHtml({ buffer });
      allMessages.push(...collectMessages(htmlConv.messages));
      markdown = htmlToFallbackPlain(htmlConv.value ?? "");
      if (markdown) fallback = "html";
    }

    const messages = [...new Set(allMessages)];

    return NextResponse.json({
      markdown,
      messages,
      fallback,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Conversion failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
