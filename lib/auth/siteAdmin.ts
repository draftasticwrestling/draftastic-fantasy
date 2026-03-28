import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireSiteAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in?next=/admin/articles");
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
