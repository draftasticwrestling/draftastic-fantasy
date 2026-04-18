import type { Metadata } from "next";
import { ConstantContactOAuthCallbackUi } from "@/app/components/ConstantContactOAuthCallbackUi";
import { resolveConstantContactCallback } from "@/lib/constantContactOAuthCallbackState";

export const metadata: Metadata = {
  title: "Constant Contact — OAuth callback",
  robots: { index: false, follow: false },
};

/**
 * Local dev redirect target matching the Constant Contact Developer Portal entry:
 * http://localhost:3000/callback
 *
 * Set CONSTANT_CONTACT_OAUTH_REDIRECT_URI=http://localhost:3000/callback in .env
 */
export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const outcome = await resolveConstantContactCallback(sp);

  return <ConstantContactOAuthCallbackUi outcome={outcome} />;
}
