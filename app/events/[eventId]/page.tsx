import { permanentRedirect } from "next/navigation";

/** Mirror Boxscore-style paths (/events/raw-YYYY-MM-DD) → our event results page. */
export default async function EventsAliasRedirect({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  permanentRedirect(`/event-results/${eventId}`);
}
