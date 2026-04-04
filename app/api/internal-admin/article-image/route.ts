import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getSiteAdminForApi } from "@/lib/auth/siteAdmin";
import { createClient } from "@/lib/supabase/server";
import {
  ARTICLE_IMAGES_BUCKET,
  extensionForImageMime,
  isAllowedArticleImageMime,
} from "@/lib/articleImages";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeBaseName(original: string): string {
  const noExt = original.replace(/\.[^./\\]+$/i, "").trim() || "image";
  return noExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * POST multipart: field `file` = image; optional `articleId` (uuid) for folder grouping (else `draft`).
 */
export async function POST(req: Request) {
  const gate = await getSiteAdminForApi();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = fd.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 400 }
    );
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!isAllowedArticleImageMime(mime)) {
    return NextResponse.json(
      { error: "Use JPEG, PNG, WebP, or GIF." },
      { status: 400 }
    );
  }

  const articleIdRaw = (fd.get("articleId") ?? "").toString().trim();
  const articleFolder =
    articleIdRaw && UUID_RE.test(articleIdRaw) ? articleIdRaw : "draft";

  const ext = extensionForImageMime(mime);
  const base = safeBaseName(file.name);
  const objectName = `${gate.user.id}/${articleFolder}/${Date.now()}-${randomUUID().slice(0, 10)}-${base}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const supabase = await createClient();
  const { error: upErr } = await supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .upload(objectName, buf, {
      contentType: mime,
      upsert: false,
    });

  if (upErr) {
    const hint =
      upErr.message?.toLowerCase().includes("bucket") || upErr.message?.toLowerCase().includes("not found")
        ? " Create the bucket and policies (run supabase/article_images_storage.sql in the SQL Editor)."
        : "";
    return NextResponse.json({ error: `${upErr.message}${hint}` }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(objectName);

  return NextResponse.json({ url: pub.publicUrl, path: objectName });
}
