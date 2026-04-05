"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { slugifyTitle, isValidArticleSlug } from "@/lib/articles";

const BYLINE_MAX = 160;
const SERIES_TITLE_MAX = 120;

type ParsedSeries =
  | { series_slug: string | null; series_title: string | null; series_part: number | null }
  | { error: string };

function parseSeries(formData: FormData): ParsedSeries {
  const slugRaw = (formData.get("series_slug") ?? "").toString().trim().toLowerCase();
  const series_slug = slugRaw || null;
  if (series_slug && !isValidArticleSlug(series_slug)) {
    return { error: "Series slug: use lowercase letters, numbers, and hyphens only." };
  }
  const titleRaw = (formData.get("series_title") ?? "").toString().trim();
  const series_title = titleRaw ? titleRaw.slice(0, SERIES_TITLE_MAX) : null;
  const partRaw = (formData.get("series_part") ?? "").toString().trim();
  let series_part: number | null = null;
  if (partRaw) {
    const n = parseInt(partRaw, 10);
    if (!Number.isFinite(n) || n < 1 || String(n) !== partRaw) {
      return { error: "Series part must be a positive whole number or left empty." };
    }
    series_part = n;
  }
  if (!series_slug && (series_title || series_part != null)) {
    return { error: "Add a series slug if you set a series title or part number." };
  }
  return { series_slug, series_title, series_part };
}

/** PostgREST / Supabase when `byline` is missing or API cache is stale. */
function isBylineSchemaError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("byline") &&
    (m.includes("schema cache") || m.includes("could not find") || m.includes("column"))
  );
}

function parseByline(formData: FormData): { byline: string | null } | { error: string } {
  const raw = (formData.get("byline") ?? "").toString().trim();
  if (!raw) return { byline: null };
  if (raw.length > BYLINE_MAX) {
    return { error: `Author name must be ${BYLINE_MAX} characters or fewer.` };
  }
  return { byline: raw };
}

export async function createArticleAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const { supabase, user } = await requireSiteAdmin();
  const title = (formData.get("title") ?? "").toString().trim();
  let slug = (formData.get("slug") ?? "").toString().trim().toLowerCase();
  const excerptRaw = (formData.get("excerpt") ?? "").toString().trim();
  const excerpt = excerptRaw || null;
  const body = (formData.get("body") ?? "").toString();
  const status = (formData.get("status") ?? "draft").toString() === "published" ? "published" : "draft";
  if (!title) return { error: "Title is required." };
  if (!slug) slug = slugifyTitle(title);
  if (!isValidArticleSlug(slug)) {
    return { error: "Slug: use lowercase letters, numbers, and hyphens only." };
  }
  const parsedByline = parseByline(formData);
  if ("error" in parsedByline) return parsedByline;
  const parsedSeries = parseSeries(formData);
  if ("error" in parsedSeries) return parsedSeries;
  const published_at = status === "published" ? new Date().toISOString() : null;
  const rowBase = {
    slug,
    title,
    excerpt,
    body,
    author_id: user.id,
    status,
    published_at,
    series_slug: parsedSeries.series_slug,
    series_title: parsedSeries.series_title,
    series_part: parsedSeries.series_part,
  };
  const rowWithByline =
    parsedByline.byline !== null ? { ...rowBase, byline: parsedByline.byline } : rowBase;
  let { data, error } = await supabase.from("articles").insert(rowWithByline).select("id").single();
  if (error && isBylineSchemaError(error.message)) {
    const retry = await supabase.from("articles").insert(rowBase).select("id").single();
    data = retry.data;
    error = retry.error;
    if (!error && data?.id) {
      revalidatePath("/news");
      revalidatePath("/");
      redirect(`/internal-admin/articles/${data.id}/edit?saved=1&bylinePending=1`);
    }
  }
  if (error) return { error: error.message };
  revalidatePath("/news");
  revalidatePath("/");
  redirect(`/internal-admin/articles/${data!.id}/edit`);
}

export async function updateArticleAction(
  id: string,
  formData: FormData
): Promise<{ error: string } | void> {
  const { supabase } = await requireSiteAdmin();
  const title = (formData.get("title") ?? "").toString().trim();
  let slug = (formData.get("slug") ?? "").toString().trim().toLowerCase();
  const excerptRaw = (formData.get("excerpt") ?? "").toString().trim();
  const excerpt = excerptRaw || null;
  const body = (formData.get("body") ?? "").toString();
  const status = (formData.get("status") ?? "draft").toString() === "published" ? "published" : "draft";
  if (!title) return { error: "Title is required." };
  if (!slug) slug = slugifyTitle(title);
  if (!isValidArticleSlug(slug)) {
    return { error: "Slug: use lowercase letters, numbers, and hyphens only." };
  }
  const parsedByline = parseByline(formData);
  if ("error" in parsedByline) return parsedByline;
  const parsedSeries = parseSeries(formData);
  if ("error" in parsedSeries) return parsedSeries;
  let published_at: string | null = null;
  if (status === "published") {
    const { data: existing } = await supabase
      .from("articles")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    const prev = (existing as { published_at?: string | null } | null)?.published_at;
    published_at = prev ?? new Date().toISOString();
  }
  const updateBase = {
    slug,
    title,
    excerpt,
    body,
    status,
    published_at,
    series_slug: parsedSeries.series_slug,
    series_title: parsedSeries.series_title,
    series_part: parsedSeries.series_part,
  };
  const updateRow = { ...updateBase, byline: parsedByline.byline };
  let { error } = await supabase.from("articles").update(updateRow).eq("id", id);
  if (error && isBylineSchemaError(error.message)) {
    const retry = await supabase.from("articles").update(updateBase).eq("id", id);
    error = retry.error;
    if (!error) {
      revalidatePath("/news");
      revalidatePath(`/news/${slug}`);
      revalidatePath("/");
      revalidatePath("/internal-admin/articles");
      redirect(`/internal-admin/articles/${id}/edit?saved=1&bylinePending=1`);
    }
  }
  if (error) return { error: error.message };
  revalidatePath("/news");
  revalidatePath(`/news/${slug}`);
  revalidatePath("/");
  revalidatePath("/internal-admin/articles");
  redirect(`/internal-admin/articles/${id}/edit?saved=1`);
}

export async function deleteArticleAction(id: string): Promise<{ error: string } | void> {
  const { supabase } = await requireSiteAdmin();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/news");
  revalidatePath("/");
  revalidatePath("/internal-admin/articles");
  redirect("/internal-admin/articles");
}
