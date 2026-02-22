"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/profiles";

const TOP_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leagues", label: "Private Leagues" },
  { href: "/league/teams", label: "Legacy League" },
  { href: "/mvl", label: "MVL Example" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/wrestlers", label: "Wrestlers" },
  { href: "/score", label: "Scored Events" },
] as const;

const LEAGUE_SUB_LINKS = [
  { href: "/league/teams", label: "Teams" },
  { href: "/league/draft", label: "Draft" },
  { href: "/league/trades", label: "Trades" },
  { href: "/league/free-agents", label: "Free Agents" },
] as const;

function getPrivateLeagueSlug(pathname: string): string | null {
  if (!pathname.startsWith("/leagues/")) return null;
  const parts = pathname.slice(1).split("/");
  if (parts[1] === "new" || parts[1] === "join" || !parts[1]) return null;
  return parts[1];
}

function formatLeagueSlugForDisplay(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function getSecondaryLabel(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname === "/leagues") return "Private Leagues";
  const leagueSlug = getPrivateLeagueSlug(pathname);
  if (leagueSlug) {
    if (pathname === `/leagues/${leagueSlug}` || pathname === `/leagues/${leagueSlug}/`) return "League";
    if (pathname.startsWith(`/leagues/${leagueSlug}/team`)) return "Roster";
    if (pathname.startsWith(`/leagues/${leagueSlug}/matchups`)) return "Matchup";
    if (pathname.startsWith(`/leagues/${leagueSlug}/free-agents`)) return "Wrestlers";
    if (pathname.startsWith(`/leagues/${leagueSlug}/draft`)) return "Draft";
    if (pathname.startsWith(`/leagues/${leagueSlug}/proposals`)) return "Trades";
    return "League";
  }
  if (pathname.startsWith("/leagues/")) return "Private Leagues";
  if (pathname === "/league" || pathname === "/league/teams") return "Legacy League · Teams";
  if (pathname === "/league/draft") return "Legacy League · Draft";
  if (pathname === "/league/trades") return "Legacy League · Trades";
  if (pathname === "/league/free-agents") return "Legacy League · Free Agents";
  if (pathname.startsWith("/league/")) return "Legacy League · Team";
  if (pathname.startsWith("/how-it-works")) return "How it works";
  if (pathname.startsWith("/wrestlers")) return "Wrestlers";
  if (pathname.startsWith("/score")) return "Scored Events";
  if (pathname.startsWith("/results")) return "Event results";
  if (pathname.startsWith("/mvl")) return "MVL Example";
  if (pathname.startsWith("/auth")) return "Account";
  if (pathname.startsWith("/account")) return "Account";
  return "Overview";
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const secondaryLabel = getSecondaryLabel(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [user?.id]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <>
      <header className="nav-header">
        <Link href="/" className="nav-header-brand">
          Draftastic Fantasy
        </Link>
        <div className="nav-header-actions">
          {user ? (
            <>
              <Link
                href="/account"
                className="nav-header-link"
                title={user.email ?? undefined}
              >
                {profile?.display_name?.trim() || user.email || "Signed in"}
              </Link>
              <button type="button" onClick={handleSignOut} className="nav-header-btn">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" className="nav-header-link">
                Sign in
              </Link>
              <Link href="/auth/sign-up" className="nav-header-cta">
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <nav className="nav-primary-wrap" aria-label="Main">
        <ul className="nav-primary-list">
          {TOP_LINKS.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`nav-primary-link ${isActive ? "is-active" : ""}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="nav-secondary-wrap" aria-label="Section">
        <ul className="nav-secondary-list">
          {getPrivateLeagueSlug(pathname) ? (
            (() => {
              const slug = getPrivateLeagueSlug(pathname)!;
              const leagueLabel = formatLeagueSlugForDisplay(slug);
              const rosterHref = user?.id
                ? `/leagues/${slug}/team/${encodeURIComponent(user.id)}`
                : `/leagues/${slug}/team`;
              const subLinks = [
                { href: `/leagues/${slug}`, label: "League" },
                { href: rosterHref, label: "Roster" },
                { href: `/leagues/${slug}/matchups`, label: "Matchup" },
                { href: `/leagues/${slug}/free-agents`, label: "Wrestlers" },
              ];
              return (
                <>
                  <li>
                    <span className="nav-secondary-label">{leagueLabel}</span>
                  </li>
                  {subLinks.map(({ href, label }) => {
                    const isLeague = href === `/leagues/${slug}`;
                    const isRoster = label === "Roster";
                    const isActive = isLeague
                      ? pathname === href || pathname === `${href}/`
                      : isRoster
                        ? pathname.startsWith(`/leagues/${slug}/team`)
                        : pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={label}>
                        <Link
                          href={href}
                          className={`nav-secondary-link ${isActive ? "is-active" : ""}`}
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </>
              );
            })()
          ) : pathname.startsWith("/league") ? (
            LEAGUE_SUB_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || (href === "/league/teams" && pathname === "/league");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`nav-secondary-link ${isActive ? "is-active" : ""}`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })
          ) : (
            <li>
              <span className="nav-secondary-context">{secondaryLabel}</span>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}
