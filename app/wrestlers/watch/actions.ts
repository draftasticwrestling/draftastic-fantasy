"use server";

import { revalidatePath } from "next/cache";
import { removeFromWatchlist } from "@/lib/watchlist";

export async function removeFromWatchlistAction(formData: FormData): Promise<void> {
  const wrestlerId = (formData.get("wrestlerId") as string)?.trim();
  if (!wrestlerId) return;
  await removeFromWatchlist(wrestlerId);
  revalidatePath("/wrestlers/watch");
  const leagueSlug = (formData.get("leagueSlug") as string)?.trim();
  if (leagueSlug) revalidatePath(`/leagues/${leagueSlug}/watchlist`);
}
