"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/profiles";

const LAST_LEAGUE_KEY = "draftastic_last_league_slug";

type LeagueItem = { slug: string; name: string; role: "commissioner" | "owner" };

const ADMIN_LINKS = [
  { href: "/league/teams", label: "Legacy League" },
  { href: "/mvl", label: "MVL Example" },
] as const;

function getLeagueSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/leagues/")) return null;
  const parts = pathname.slice(1).split("/");
  if (parts[1] === "new" || parts[1] === "join" || !parts[1]) return null;
  return parts[1];
}

function getActivePrimary(pathname: string, slug: string): string | null {
  if (!slug || !pathname.startsWith(`/leagues/${slug}/`)) return null;
  const rest = pathname.slice(`/leagues/${slug}/`.length).split("/")[0];
  if (rest === "standings" || rest === "team-stats" || rest === "transactions" || rest === "free-agents" || rest === "watchlist" || rest === "team-log" || rest === "edit-team-info" || rest === "wrestler-updates" || rest === "team") return "my-team";
  if (rest === "league-leaders" || rest === "injury-report" || rest === "roster-changes" || rest === "stat-corrections" || rest === "") return "league";
  if (rest === "wrestlers") return "wrestlers";
  if (rest === "matchups") return "matchups";
  if (rest === "draft" || rest === "draft-history" || rest === "mock-draft" || rest === "draft-settings" || rest === "draft-order") return "draft";
  if (rest === "notify-league" || rest === "manage-rosters" || rest === "league-settings" || rest === "pending-trades") return "gm-tools";
  return null;
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leagues, setLeagues] = useState<LeagueItem[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [leagueSwitcherOpen, setLeagueSwitcherOpen] = useState(false);
  const [lastVisitedSlug, setLastVisitedSlug] = useState<string | null>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const leagueSwitcherRef = useRef<HTMLDivElement>(null);

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
      setLeagues([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
    fetch("/api/me/leagues")
      .then((r) => r.json())
      .then((data) => {
        const list = data?.leagues ?? [];
        setLeagues(list);
        try {
          const last = localStorage.getItem(LAST_LEAGUE_KEY);
          if (last && list.some((l: LeagueItem) => l.slug === last)) setLastVisitedSlug(last);
          else if (list.length > 0 && !last) setLastVisitedSlug(list[0].slug);
        } catch {
          /* ignore */
        }
      })
      .catch(() => setLeagues([]));
  }, [user?.id]);

  const slugFromPath = getLeagueSlugFromPath(pathname);
  useEffect(() => {
    if (slugFromPath) {
      setLastVisitedSlug(slugFromPath);
      try {
        localStorage.setItem(LAST_LEAGUE_KEY, slugFromPath);
      } catch {
        /* ignore */
      }
    }
  }, [slugFromPath]);

  const currentLeagueSlug =
    slugFromPath ?? (lastVisitedSlug && leagues.some((l) => l.slug === lastVisitedSlug) ? lastVisitedSlug : null) ?? leagues[0]?.slug ?? null;

  const currentLeague = leagues.find((l) => l.slug === currentLeagueSlug);
  const isCommissioner = currentLeague?.role === "commissioner";
  const activePrimary = currentLeagueSlug ? getActivePrimary(pathname, currentLeagueSlug) : null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminOpen(false);
      if (leagueSwitcherRef.current && !leagueSwitcherRef.current.contains(e.target as Node)) setLeagueSwitcherOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  const rosterHref = user?.id && currentLeagueSlug
    ? `/leagues/${currentLeagueSlug}/team/${encodeURIComponent(user.id)}`
    : currentLeagueSlug
      ? `/leagues/${currentLeagueSlug}/team`
      : "#";

  const myTeamSub = currentLeagueSlug
    ? [
        { href: rosterHref, label: "Roster" },
        { href: `/leagues/${currentLeagueSlug}/standings`, label: "Standings" },
        { href: `/leagues/${currentLeagueSlug}/team-stats`, label: "Team Stats" },
        { href: `/leagues/${currentLeagueSlug}/transactions`, label: "Transactions" },
        { href: `/leagues/${currentLeagueSlug}/free-agents`, label: "Free Agents" },
        { href: `/leagues/${currentLeagueSlug}/watchlist`, label: "Watchlist" },
        { href: `/leagues/${currentLeagueSlug}/team-log`, label: "Team Log" },
        { href: `/leagues/${currentLeagueSlug}/edit-team-info`, label: "Edit Team Info" },
        { href: `/leagues/${currentLeagueSlug}/wrestler-updates`, label: "Wrestler Updates" },
      ]
    : [];
  const leagueSub = currentLeagueSlug
    ? [
        { href: `/leagues/${currentLeagueSlug}`, label: "League" },
        { href: `/leagues/${currentLeagueSlug}/league-leaders`, label: "League Leaders" },
        { href: `/leagues/${currentLeagueSlug}/injury-report`, label: "Injury Report" },
        { href: `/leagues/${currentLeagueSlug}/roster-changes`, label: "Roster Changes" },
        { href: `/leagues/${currentLeagueSlug}/stat-corrections`, label: "Stat Corrections" },
      ]
    : [];
  const draftSub = currentLeagueSlug
    ? [
        { href: `/leagues/${currentLeagueSlug}/draft`, label: "Draft" },
        { href: `/leagues/${currentLeagueSlug}/draft-history`, label: "Draft History" },
        { href: `/leagues/${currentLeagueSlug}/mock-draft`, label: "Mock Draft" },
        { href: `/leagues/${currentLeagueSlug}/draft-settings`, label: "Draft Settings" },
        { href: `/leagues/${currentLeagueSlug}/draft-order`, label: "Draft Order" },
      ]
    : [];
  const gmSub = currentLeagueSlug
    ? [
        { href: `/leagues/${currentLeagueSlug}/notify-league`, label: "Notify League" },
        { href: `/leagues/${currentLeagueSlug}/manage-rosters`, label: "Manage Rosters" },
        { href: `/leagues/${currentLeagueSlug}/league-settings`, label: "League Settings" },
        { href: `/leagues/${currentLeagueSlug}/pending-trades`, label: "Pending Trades" },
      ]
    : [];

  const showLowerBar = user && leagues.length > 0;

  return (
    <>
      <header className="nav-header">
        <Link href="/" className="nav-header-brand-wrap">
          <img src="/draftastic_belt_logo.png" alt="" className="nav-header-logo" />
          <span className="nav-header-brand nav-header-brand-full">Draftastic Pro Wrestling Fantasy</span>
          <span className="nav-header-brand nav-header-brand-short" aria-hidden>Draftastic</span>
        </Link>

        <nav className="nav-top-links" aria-label="Site">
          <div className="nav-dropdown-wrap" ref={adminRef}>
            <button
              type="button"
              className="nav-dropdown-trigger"
              onClick={() => setAdminOpen((o) => !o)}
              aria-expanded={adminOpen}
              aria-haspopup="true"
            >
              Admin Menu
              <span aria-hidden>▾</span>
            </button>
            {adminOpen && (
              <div className="nav-dropdown-panel">
                {ADMIN_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href} onClick={() => setAdminOpen(false)}>
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href="/leagues/new" className="nav-top-cta">
            +Create a League
          </Link>
          <Link href="/how-it-works" className="nav-top-link">How It Works</Link>
          <Link href="/event-results" className="nav-top-link">Event Results</Link>
          <Link href="/about-us" className="nav-top-link">About Us</Link>
          <Link href="/contact-us" className="nav-top-link">Contact Us</Link>
        </nav>

        <div className="nav-header-actions">
          {user ? (
            <>
              <Link href="/account" className="nav-header-link" title={user.email ?? undefined}>
                {profile?.display_name?.trim() || user.email || "Signed in"}
              </Link>
              <button type="button" onClick={handleSignOut} className="nav-header-btn">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/" className="nav-header-link">Home</Link>
              <Link href="/auth/sign-in" className="nav-header-link">Sign in</Link>
              <Link href="/auth/sign-up" className="nav-header-cta">Sign up</Link>
            </>
          )}
        </div>
      </header>

      {showLowerBar && currentLeagueSlug && (
        <>
          <nav className="nav-primary-wrap" aria-label="League">
            <ul className="nav-primary-list">
              {leagues.length >= 2 && (
                <li>
                  <div className="nav-dropdown-wrap" ref={leagueSwitcherRef}>
                    <button
                      type="button"
                      className="nav-primary-link"
                      style={{ border: "none", background: "none", cursor: "pointer", font: "inherit" }}
                      onClick={() => setLeagueSwitcherOpen((o) => !o)}
                      aria-expanded={leagueSwitcherOpen}
                    >
                      {currentLeague?.name ?? currentLeagueSlug} ▾
                    </button>
                    {leagueSwitcherOpen && (
                      <div className="nav-dropdown-panel">
                        {leagues.map((l) => (
                          <Link
                            key={l.slug}
                            href={`/leagues/${l.slug}`}
                            onClick={() => {
                              setLeagueSwitcherOpen(false);
                              try {
                                localStorage.setItem(LAST_LEAGUE_KEY, l.slug);
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            {l.name}
                            {l.role === "commissioner" ? " (GM)" : ""}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )}
              <li>
                <Link
                  href={rosterHref}
                  className={`nav-primary-link ${activePrimary === "my-team" ? "is-active" : ""}`}
                >
                  My Team
                </Link>
              </li>
              <li>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}` : "#"}
                  className={`nav-primary-link ${activePrimary === "league" ? "is-active" : ""}`}
                >
                  League
                </Link>
              </li>
              <li>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}/wrestlers` : "#"}
                  className={`nav-primary-link ${activePrimary === "wrestlers" ? "is-active" : ""}`}
                >
                  Wrestlers
                </Link>
              </li>
              <li>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}/matchups` : "#"}
                  className={`nav-primary-link ${activePrimary === "matchups" ? "is-active" : ""}`}
                >
                  Matchups
                </Link>
              </li>
              <li>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}/draft` : "#"}
                  className={`nav-primary-link ${activePrimary === "draft" ? "is-active" : ""}`}
                >
                  Draft
                </Link>
              </li>
              {isCommissioner && (
                <li>
                  <Link
                    href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}/notify-league` : "#"}
                    className={`nav-primary-link ${activePrimary === "gm-tools" ? "is-active" : ""}`}
                  >
                    GM Tools
                  </Link>
                </li>
              )}
              <li>
                <Link href="/leagues/new" className="nav-primary-link">
                  +Start Another League
                </Link>
              </li>
            </ul>
          </nav>

          <nav className="nav-secondary-wrap" aria-label="Section">
            <ul className="nav-secondary-list">
              {activePrimary === "my-team" &&
                myTeamSub.map(({ href, label }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <li key={href}>
                      <Link href={href} className={`nav-secondary-link ${isActive ? "is-active" : ""}`}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              {activePrimary === "league" &&
                leagueSub.map(({ href, label }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  const isLeagueHome = href === `/leagues/${currentLeagueSlug}`;
                  const active = isLeagueHome ? pathname === href || pathname === `${href}/` : isActive;
                  return (
                    <li key={href}>
                      <Link href={href} className={`nav-secondary-link ${active ? "is-active" : ""}`}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              {activePrimary === "draft" &&
                draftSub.map(({ href, label }) => {
                  const isActive = href === `/leagues/${currentLeagueSlug}/draft`
                    ? pathname === href || pathname === `${href}/`
                    : pathname === href || pathname.startsWith(href + "/");
                  return (
                    <li key={href}>
                      <Link href={href} className={`nav-secondary-link ${isActive ? "is-active" : ""}`}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              {activePrimary === "gm-tools" &&
                gmSub.map(({ href, label }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <li key={href}>
                      <Link href={href} className={`nav-secondary-link ${isActive ? "is-active" : ""}`}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              {activePrimary === "matchups" && (
                <li>
                  <span className="nav-secondary-context">Matchups</span>
                </li>
              )}
              {activePrimary === "wrestlers" && (
                <li>
                  <span className="nav-secondary-context">Wrestlers</span>
                </li>
              )}
              {!activePrimary && showLowerBar && (
                <li>
                  <span className="nav-secondary-context">League</span>
                </li>
              )}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}
