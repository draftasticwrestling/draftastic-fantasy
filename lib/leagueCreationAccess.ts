import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function leagueCreationAccessIsConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("league_creation_access_codes_configured");
  if (error) return false;
  return data === true;
}

export async function consumeLeagueCreationAccessCode(
  input: string
): Promise<{ ok: boolean; error?: string; remainingUses?: number }> {
  const code = input.trim();
  if (!code) return { ok: false, error: "Enter the beta access code from your invite email." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_league_creation_access_code", {
    p_code: code,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.toLowerCase().includes("consume_league_creation_access_code")) {
      return {
        ok: false,
        error:
          "Access code verification is not configured yet. Run supabase/league_creation_access_codes.sql and insert at least one active code.",
      };
    }
    return { ok: false, error: msg || "Unable to verify access code right now." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.ok !== true) {
    return {
      ok: false,
      error:
        (row && typeof row.error === "string" && row.error) ||
        "That access code isn’t valid. Check your invite email.",
    };
  }
  return {
    ok: true,
    remainingUses: typeof row.remaining_uses === "number" ? row.remaining_uses : undefined,
  };
}
