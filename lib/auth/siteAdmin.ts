import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** For Route Handlers: same gate as requireSiteAdmin, but JSON errors instead of redirect. */
export async function getSiteAdminForApi(): Promise<
  { ok: true; user: User } | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: row, error } = await supabase
    .from("profiles")
    .select("is_site_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !row || !(row as { is_site_admin?: boolean | null }).is_site_admin) {
    return { ok: false, status: 403, error: "Site admin only" };
  }
  return { ok: true, user };
}

export async function requireSiteAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in?next=/internal-admin");
  }
  const { data: row, error } = await supabase
    .from("profiles")
    .select("is_site_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !row || !(row as { is_site_admin?: boolean | null }).is_site_admin) {
    redirect("/");
  }
  return { supabase, user };
}

export async function getIsSiteAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: row } = await supabase
    .from("profiles")
    .select("is_site_admin")
    .eq("id", user.id)
    .maybeSingle();
  return Boolean((row as { is_site_admin?: boolean | null } | null)?.is_site_admin);
}
