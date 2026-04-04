import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Service-role Supabase client for site-admin read/write (bypasses RLS).
 * Only use from `/internal-admin` after `requireSiteAdmin` in layout.
 */
export function getServiceRoleClient() {
  return getAdminClient();
}
