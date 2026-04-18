import type { Metadata } from "next";
import { ConstantContactOAuthCallbackUi } from "@/app/components/ConstantContactOAuthCallbackUi";
import { resolveConstantContactCallback } from "@/lib/constantContactOAuthCallbackState";

export const metadata: Metadata = {
  title: "Constant Contact — OAuth callback",
  robots: { index: false, follow: false },
};

/** Production-friendly Constant Contact OAuth return URL. Register this exact path in the CC portal. */
export default async function ConstantContactCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const outcome = await resolveConstantContactCallback(sp);

  return <ConstantContactOAuthCallbackUi outcome={outcome} />;
}
