import { redirect } from "next/navigation";
import { buildPlayPath } from "@/lib/playFunnel";

type Props = { searchParams: Promise<{ token?: string; code?: string }> };

/** Legacy join URL — forwards into the unified play funnel. */
export default async function JoinLeaguePage({ searchParams }: Props) {
  const { token, code } = await searchParams;
  redirect(
    buildPlayPath({
      step: token ? "join" : "join",
      token,
      code,
    })
  );
}
