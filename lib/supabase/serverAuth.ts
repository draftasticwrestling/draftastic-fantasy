import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ServerAuth = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
};

/**
 * Single Supabase server client + `getUser()` per React server request.
 * Use this anywhere you would otherwise call `createClient()` then `auth.getUser()`
 * so parallel layouts/pages dedupe the Auth round-trip.
 */
export const getServerAuth = cache(async (): Promise<ServerAuth> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user ?? null };
});
