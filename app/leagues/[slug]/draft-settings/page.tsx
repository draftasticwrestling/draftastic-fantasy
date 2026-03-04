import { redirect } from "next/navigation";

export const metadata = {
  title: "Draft Settings — Draftastic Fantasy",
  description: "Draft configuration",
};

export default async function DraftSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/leagues/${encodeURIComponent(slug)}/league-settings#draft-settings-heading`);
}
