import { redirect } from "next/navigation";

/**
 * Manual draft-order drag-and-drop is disabled for the beta. GMs randomize order once on the main Draft page.
 */
export default async function SetDraftOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/leagues/${slug}/draft`);
}
