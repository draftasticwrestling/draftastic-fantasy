"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createLeague } from "@/lib/leagues";

export type CreateLeagueState = { error?: string } | null;

export async function createLeagueAction(
  _prev: CreateLeagueState,
  formData: FormData
): Promise<CreateLeagueState> {
  const name = (formData.get("name") as string)?.trim() ?? "";
  const start_date = (formData.get("start_date") as string)?.trim() || null;
  const end_date = (formData.get("end_date") as string)?.trim() || null;

  if (!name) {
    return { error: "Enter a league name." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "You're not signed in. Sign out and sign in again, then try creating the league.",
    };
  }

  const { league, error } = await createLeague({ name, start_date, end_date });
  if (error) return { error };
  if (!league) return { error: "Failed to create league." };

  redirect(`/leagues/${league.slug}`);
}
