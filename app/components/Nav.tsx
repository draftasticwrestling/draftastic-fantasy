"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
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
  const [hoverPrimary, setHoverPrimary] = useState<"my-team" | "league" | "wrestlers" | "draft" | "gm-tools" | null>(null);
  const [lastVisitedSlug, setLastVisitedSlug] = useState<string | null>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const leagueSwitcherRef = useRef<HTMLDivElement>(null);
  const leagueSwitcherButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leaguePanelRect, setLeaguePanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

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
      const target = e.target as Node;
      if (adminRef.current && !adminRef.current.contains(target)) setAdminOpen(false);
      const leagueWrap = leagueSwitcherRef.current;
      const leaguePanel = document.getElementById("nav-league-switcher-panel");
      const clickedInsideLeague = leagueWrap?.contains(target) || leaguePanel?.contains(target);
      if (!clickedInsideLeague) setLeagueSwitcherOpen(false);
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) setMobileMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!leagueSwitcherOpen) {
      setLeaguePanelRect(null);
      return;
    }
    const btn = leagueSwitcherButtonRef.current;
    if (!btn) return;
    const updateRect = () => {
      const r = btn.getBoundingClientRect();
      setLeaguePanelRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) });
    };
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [leagueSwitcherOpen]);

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
        { href: `/leagues/${currentLeagueSlug}/wrestlers/free-agents`, label: "Free Agents" },
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
  const wrestlersSub = currentLeagueSlug
    ? [
        { href: `/leagues/${currentLeagueSlug}/wrestlers/league-leaders`, label: "League Leaders" },
        { href: `/leagues/${currentLeagueSlug}/wrestlers/free-agents`, label: "Free Agents" },
      ]
    : [];

  const showLowerBar = user && leagues.length > 0;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="nav-header" ref={mobileMenuRef}>
        <Link href="/" className="nav-header-brand-wrap" onClick={closeMobileMenu}>
          <img src="/draftastic_belt_logo.png" alt="" className="nav-header-logo" />
          <span className="nav-header-brand nav-header-brand-full">Draftastic Fantasy Pro Wrestling</span>
          <span className="nav-header-brand nav-header-brand-short" aria-hidden>Draftastic</span>
        </Link>

        <nav className="nav-top-links nav-top-links-desk" aria-label="Site">
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

        <button
          type="button"
          className="nav-mobile-menu-btn"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-expanded={mobileMenuOpen}
          aria-label="Open menu"
        >
          <span className="nav-mobile-menu-icon" aria-hidden />
        </button>

        <div className="nav-header-actions nav-header-actions-desk">
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

        {mobileMenuOpen && (
          <div className="nav-mobile-panel" role="dialog" aria-label="Site menu">
          <nav className="nav-mobile-panel-inner" aria-label="Site">
            <Link href="/" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              Home
            </Link>
            {ADMIN_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                {label}
              </Link>
            ))}
            <Link href="/leagues/new" className="nav-mobile-panel-cta" onClick={closeMobileMenu}>
              +Create a League
            </Link>
            <Link href="/how-it-works" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              How It Works
            </Link>
            <Link href="/event-results" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              Event Results
            </Link>
            <Link href="/about-us" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              About Us
            </Link>
            <Link href="/contact-us" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              Contact Us
            </Link>
          </nav>
          <div className="nav-mobile-panel-actions">
            {user ? (
              <>
                <Link href="/account" className="nav-mobile-panel-link" onClick={closeMobileMenu} title={user.email ?? undefined}>
                  {profile?.display_name?.trim() || user.email || "Signed in"}
                </Link>
                <button type="button" onClick={() => { handleSignOut(); closeMobileMenu(); }} className="nav-mobile-panel-btn">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/sign-in" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                  Sign in
                </Link>
                <Link href="/auth/sign-up" className="nav-mobile-panel-cta" onClick={closeMobileMenu}>
                  Sign up
                </Link>
              </>
            )}
          </div>
          </div>
        )}
      </header>

      {showLowerBar && currentLeagueSlug && (
        <div
          className="nav-lower-bar"
          onMouseLeave={() => setHoverPrimary(null)}
        >
          <nav className="nav-primary-wrap" aria-label="League">
            <ul className="nav-primary-list">
              <li>
                <div className="nav-dropdown-wrap" ref={leagueSwitcherRef}>
                  <button
                    ref={leagueSwitcherButtonRef}
                    type="button"
                    className="nav-dropdown-trigger nav-primary-link"
                    style={{ border: "none", background: "none", cursor: "pointer", font: "inherit", color: "inherit" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setLeagueSwitcherOpen((o) => !o);
                    }}
                    aria-expanded={leagueSwitcherOpen}
                    aria-haspopup="true"
                    aria-label="Switch league"
                  >
                    {currentLeague?.name ?? currentLeagueSlug} ▾
                  </button>
                  {leagueSwitcherOpen &&
                    leaguePanelRect &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <div
                        id="nav-league-switcher-panel"
                        className="nav-dropdown-panel nav-dropdown-panel-portal"
                        style={{
                          position: "fixed",
                          top: leaguePanelRect.top,
                          left: leaguePanelRect.left,
                          width: leaguePanelRect.width,
                          minWidth: 160,
                        }}
                      >
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
                        <Link
                          href="/leagues/new"
                          className="nav-dropdown-panel-new"
                          onClick={() => setLeagueSwitcherOpen(false)}
                        >
                          + Start Another League
                        </Link>
                      </div>,
                      document.body
                    )}
                </div>
              </li>
              <li onMouseEnter={() => setHoverPrimary("my-team")}>
                <Link
                  href={rosterHref}
                  className={`nav-primary-link ${activePrimary === "my-team" ? "is-active" : ""}`}
                >
                  My Team
                </Link>
              </li>
              <li onMouseEnter={() => setHoverPrimary("league")}>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}` : "#"}
                  className={`nav-primary-link ${activePrimary === "league" ? "is-active" : ""}`}
                >
                  League
                </Link>
              </li>
              <li onMouseEnter={() => setHoverPrimary("wrestlers")}>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}/wrestlers/league-leaders` : "#"}
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
              <li onMouseEnter={() => setHoverPrimary("draft")}>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}/draft` : "#"}
                  className={`nav-primary-link ${activePrimary === "draft" ? "is-active" : ""}`}
                >
                  Draft
                </Link>
              </li>
              {isCommissioner && (
                <li onMouseEnter={() => setHoverPrimary("gm-tools")}>
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
              {(hoverPrimary ?? activePrimary) === "my-team" &&
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
              {(hoverPrimary ?? activePrimary) === "league" &&
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
              {(hoverPrimary ?? activePrimary) === "draft" &&
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
              {(hoverPrimary ?? activePrimary) === "gm-tools" &&
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
              {(hoverPrimary ?? activePrimary) === "matchups" && (
                <li>
                  <span className="nav-secondary-context">Matchups</span>
                </li>
              )}
              {(hoverPrimary ?? activePrimary) === "wrestlers" &&
                wrestlersSub.map(({ href, label }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <li key={href}>
                      <Link href={href} className={`nav-secondary-link ${isActive ? "is-active" : ""}`}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              {!(hoverPrimary ?? activePrimary) && showLowerBar && (
                <li>
                  <span className="nav-secondary-context">League</span>
                </li>
              )}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
