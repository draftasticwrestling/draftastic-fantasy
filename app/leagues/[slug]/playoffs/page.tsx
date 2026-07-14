import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

/** Legacy URL — bracket lives on Matchups via ?view=bracket. */
export default async function LeaguePlayoffsRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/leagues/${slug}/matchups?view=bracket`);
}
