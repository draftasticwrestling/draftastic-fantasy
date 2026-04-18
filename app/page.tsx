import Link from "next/link";
import { redirect } from "next/navigation";
import { FantasyHomeLink } from "@/app/components/FantasyHomeLink";
import HubLatestHeadlinesSection from "@/app/components/HubLatestHeadlinesSection";
import FantasyHubHero from "@/app/components/FantasyHubHero";

/** Cache homepage shell and revalidate frequently to reduce SSR compute. */
export const revalidate = 120;

export const metadata = {
  title: "Draftastic Pro Wrestling — Results & News",
  description: "Event results, fantasy scoring, and commentary — Draftastic Pro Wrestling.",
};

export default async function HubHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : undefined;
  const oauthErr = typeof sp.error === "string" ? sp.error : undefined;
  if (code || oauthErr) {
    const qs = new URLSearchParams();
    if (code) qs.set("code", code);
    if (oauthErr) qs.set("error", oauthErr);
    const ed = sp.error_description;
    if (typeof ed === "string") qs.set("error_description", ed);
    const st = sp.state;
    if (typeof st === "string") qs.set("state", st);
    redirect(`/constant-contact-callback?${qs.toString()}`);
  }

  return (
    <>
      <FantasyHubHero />

      <div className="hub-shell-wrap">
        <div className="hub-shell">
          <aside className="hub-col hub-col-side" aria-label="Quick links">
            <h2 className="hub-col-title">Quick links</h2>
            <nav className="hub-quick-nav">
              <Link href="/event-results">Events</Link>
              <Link href="/wrestlers">Wrestlers</Link>
              <FantasyHomeLink>Fantasy home</FantasyHomeLink>
              <Link href="/how-it-works">Fantasy rules</Link>
            </nav>
          </aside>

          <HubLatestHeadlinesSection headlineVariant="hub" />
        </div>
      </div>
    </>
  );
}
