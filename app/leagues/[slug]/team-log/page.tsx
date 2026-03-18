import { redirect } from "next/navigation";

export const metadata = {
  title: "Team Log — Draftastic Fantasy",
  description: "Team activity log",
};

export default async function TeamLogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/leagues/${slug}/transactions`);
}
