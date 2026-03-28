"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  slugifyTitle,
  isValidArticleSlug,
} from "@/lib/articles";

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
  const published_at = status === "published" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug,
      title,
      excerpt,
      body,
      author_id: user.id,
      status,
      published_at,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/news");
  revalidatePath("/");
  redirect(`/admin/articles/${data.id}/edit`);
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
  const { error } = await supabase
    .from("articles")
    .update({
      slug,
      title,
      excerpt,
      body,
      status,
      published_at,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/news");
  revalidatePath(`/news/${slug}`);
  revalidatePath("/");
  revalidatePath("/admin/articles");
  redirect(`/admin/articles/${id}/edit?saved=1`);
}

export async function deleteArticleAction(id: string): Promise<{ error: string } | void> {
  const { supabase } = await requireSiteAdmin();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/news");
  revalidatePath("/");
  revalidatePath("/admin/articles");
  redirect("/admin/articles");
}
