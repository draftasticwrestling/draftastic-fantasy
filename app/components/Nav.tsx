"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/profiles";
import { siteLogoHref } from "@/lib/siteLogo";
import { computeFantasyHomeHref, getLeagueSlugFromPath } from "@/lib/fantasyHomeHref";
import { pleDefaultHref, pleHrefForEntry, pleNavEntriesForLeagueWindow, type PleNavEntry } from "@/lib/pleLeagueMenu";
import { leagueShowsMatchupsInNav } from "@/lib/leagueNavVisibility";
import { leagueUsesSalaryCap } from "@/lib/leagueStructure";
import { resolveManagerPresetDisplayUrl } from "@/lib/managerAvatarPresets";
import { getXpLevelInfo } from "@/lib/xp/xpLevels";
import { PLAY_PATH } from "@/lib/playFunnel";

const LAST_LEAGUE_KEY = "draftastic_last_league_slug";

type LeagueItem = {
  slug: string;
  name: string;
  role: "commissioner" | "owner";
  league_type?: string | null;
  season_slug?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type MobileLeagueSectionKey = "league" | "my-team" | "wrestlers" | "matchups" | "ple" | "draft" | "gm-tools";

/** Grouped admin menu: portal vs internal tools vs demos (flat list for mobile order). */
const ADMIN_MENU_SECTIONS: readonly {
  title: string;
  links: readonly { href: string; label: string; primary?: boolean }[];
}[] = [
  {
    title: "Admin portal",
    links: [{ href: "/internal-admin", label: "Site admin", primary: true }],
  },
  {
    title: "Tools",
    links: [
      { href: "/internal-admin/engagement", label: "Season engagement" },
      { href: "/internal-admin/nudges", label: "Login nudges" },
      { href: "/internal-admin/draft-testing", label: "Draft testing" },
    ],
  },
  {
    title: "Demos",
    links: [
      { href: "/league/teams", label: "Legacy league" },
      { href: "/mvl", label: "MVL example" },
    ],
  },
] as const;

function getActivePrimary(pathname: string, slug: string): MobileLeagueSectionKey | null {
  if (!slug) return null;
  const base = `/leagues/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "league";
  if (!pathname.startsWith(`${base}/`)) return null;
  const rest = pathname.slice(base.length + 1).split("/")[0];
  if (rest === "standings" || rest === "roster-changes") return "league";
  if (rest === "faction") return "my-team";
  if (rest === "team" || rest === "transactions" || rest === "team-log" || rest === "watchlist" || rest === "edit-team-info" || rest === "faction-actions") return "my-team";
  if (rest === "") return "league";
  if (rest === "wrestlers" || rest === "league-leaders" || rest === "stat-corrections") return "wrestlers";
  if (rest === "matchups") return "matchups";
  if (rest === "ple") return "ple";
  if (rest === "draft" || rest === "draft-history" || rest === "draft-settings") return "draft";
  if (rest === "notify-league" || rest === "manage-rosters" || rest === "league-settings" || rest === "pending-trades") return "gm-tools";
  return null;
}

type FantasyMobileTabKey = "league" | "faction" | "matchups" | "wrestlers" | "draft";

function getFantasyMobilePrimaryTab(
  pathname: string,
  slug: string,
  opts?: { showMatchupsInTopNav?: boolean }
): FantasyMobileTabKey | null {
  if (!slug) return null;
  const base = `/leagues/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "league";
  if (!pathname.startsWith(`${base}/`)) return null;

  const after = pathname.slice(base.length + 1);
  const head = after.split("/")[0] ?? "";

  if (head === "faction") return "faction";
  if (head === "team") return "faction";
  if (head === "transactions" || head === "team-log" || head === "watchlist" || head === "edit-team-info" || head === "faction-actions") return "faction";

  if (head === "matchups") return "matchups";

  if (head === "wrestlers" || head === "league-leaders" || head === "stat-corrections") return "wrestlers";

  if (head === "draft" || head === "draft-history" || head === "draft-settings") {
    return opts?.showMatchupsInTopNav ? "league" : "draft";
  }

  return "league";
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leagues, setLeagues] = useState<LeagueItem[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [leagueSwitcherOpen, setLeagueSwitcherOpen] = useState(false);
  const [hoverPrimary, setHoverPrimary] = useState<"my-team" | "league" | "wrestlers" | "matchups" | "ple" | "draft" | "gm-tools" | null>(null);
  const [lastVisitedSlug, setLastVisitedSlug] = useState<string | null>(null);
  const [accountHoverTitle, setAccountHoverTitle] = useState<string>("");
  const adminRef = useRef<HTMLDivElement>(null);
  const leagueSwitcherRef = useRef<HTMLDivElement>(null);
  const leagueSwitcherButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const secondaryWrapRef = useRef<HTMLElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leaguePanelRect, setLeaguePanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const setHoverPrimaryStable = (value: typeof hoverPrimary) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setHoverPrimary(value);
  };

  const handlePrimaryEnter = (primary: typeof hoverPrimary, e: React.MouseEvent) => {
    const from = e.relatedTarget;
    if (from instanceof Node && secondaryWrapRef.current?.contains(from)) return;
    setHoverPrimaryStable(primary);
  };

  const handleLowerBarLeave = (e: React.MouseEvent) => {
    const to = e.relatedTarget;
    if (to instanceof Node && secondaryWrapRef.current?.contains(to)) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setHoverPrimary(null), 150);
  };

  const handleLowerBarEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

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
      setAccountHoverTitle("");
      return;
    }
    const supabase = createClient();
    const loadProfile = () => {
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_site_admin, created_at, updated_at")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data as Profile | null));
    };
    loadProfile();
    (async () => {
      try {
        const { data } = await supabase
          .from("user_xp_state")
          .select("total_xp")
          .eq("user_id", user.id)
          .maybeSingle();
        const xp = Math.max(0, Number((data as { total_xp?: number } | null)?.total_xp ?? 0));
        const level = getXpLevelInfo(xp);
        const lines = [
          user.email?.trim() || "",
          `${xp.toLocaleString()} XP`,
          level.label,
        ].filter(Boolean);
        setAccountHoverTitle(lines.join("\n"));
      } catch {
        setAccountHoverTitle(user.email?.trim() || "");
      }
    })();
    const onProfileUpdated = () => loadProfile();
    window.addEventListener("draftastic-profile-updated", onProfileUpdated);
    fetch("/api/me/leagues")
      .then((r) => r.json())
      .then((data: { leagues?: LeagueItem[] }) => {
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
    return () => window.removeEventListener("draftastic-profile-updated", onProfileUpdated);
  }, [user?.id]);

  const slugFromPath = getLeagueSlugFromPath(pathname);

  /** Site admins previewing a league from internal admin are not members — merge nav metadata for that slug. */
  useEffect(() => {
    if (!user?.id || !profile?.is_site_admin || !slugFromPath) return;
    let cancelled = false;
    fetch(`/api/me/leagues?previewSlug=${encodeURIComponent(slugFromPath)}`)
      .then((r) => r.json())
      .then((data: { leagues?: LeagueItem[] }) => {
        if (cancelled) return;
        const list = data?.leagues ?? [];
        setLeagues((prev) => {
          const bySlug = new Map(prev.map((x) => [x.slug, x]));
          for (const l of list) {
            bySlug.set(l.slug, l);
          }
          return Array.from(bySlug.values());
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.is_site_admin, slugFromPath]);
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
  const isSalaryCapLeague = leagueUsesSalaryCap(currentLeague?.league_type);
  const showMatchupsInTopNav = leagueShowsMatchupsInNav(currentLeague?.league_type);
  const isSiteAdmin = Boolean(profile?.is_site_admin);
  const activePrimary = currentLeagueSlug ? getActivePrimary(pathname, currentLeagueSlug) : null;

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (adminRef.current && !adminRef.current.contains(target)) setAdminOpen(false);
      const leagueWrap = leagueSwitcherRef.current;
      const leaguePanel = document.getElementById("nav-league-switcher-panel");
      const clickedInsideLeague = leagueWrap?.contains(target) || leaguePanel?.contains(target);
      if (!clickedInsideLeague) setLeagueSwitcherOpen(false);
      const mobilePanel = document.getElementById("nav-mobile-panel");
      const inMobilePanel = mobilePanel?.contains(target);
      const inHeader = mobileMenuRef.current?.contains(target);
      if (!inHeader && !inMobilePanel) setMobileMenuOpen(false);
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

  const rosterHref = currentLeagueSlug ? `/leagues/${currentLeagueSlug}/faction` : "#";
  const desktopMyFactionHref =
    currentLeagueSlug && user?.id
      ? `/leagues/${currentLeagueSlug}/team/${encodeURIComponent(user.id)}`
      : currentLeagueSlug
        ? `/leagues/${currentLeagueSlug}/team`
        : "#";
  const fantasyHref = computeFantasyHomeHref({ user, pathname, leagues, lastVisitedSlug });

  const pleNavItems: PleNavEntry[] = currentLeagueSlug
    ? pleNavEntriesForLeagueWindow(
        currentLeague?.season_slug ?? null,
        currentLeague?.start_date ?? null,
        currentLeague?.end_date ?? null
      )
    : [];
  const pleBarHref = currentLeagueSlug
    ? pleDefaultHref(
        currentLeagueSlug,
        currentLeague?.season_slug ?? null,
        currentLeague?.start_date ?? null,
        currentLeague?.end_date ?? null
      )
    : "#";

  function pleEntryIsActive(entry: PleNavEntry): boolean {
    if (!currentLeagueSlug) return false;
    const href = pleHrefForEntry(currentLeagueSlug, entry);
    return pathname === href || pathname === `${href}/`;
  }

  const myTeamSub = currentLeagueSlug
    ? [
        ...(user?.id
          ? [
              {
                href: `/leagues/${currentLeagueSlug}/team/${encodeURIComponent(user.id)}`,
                label: "My Faction",
              },
            ]
          : [{ href: `/leagues/${currentLeagueSlug}/team`, label: "My Faction" }]),
        { href: `/leagues/${currentLeagueSlug}/transactions`, label: "Faction Log" },
        { href: `/leagues/${currentLeagueSlug}/watchlist`, label: "Watchlist" },
        { href: `/leagues/${currentLeagueSlug}/edit-team-info`, label: "Edit Faction Info" },
      ]
    : [];
  const leagueSub = currentLeagueSlug
    ? [
        { href: `/leagues/${currentLeagueSlug}`, label: "League" },
        { href: `/leagues/${currentLeagueSlug}/standings`, label: "Standings" },
        { href: `/leagues/${currentLeagueSlug}/roster-changes`, label: "Transactions" },
        { href: `/leagues/${currentLeagueSlug}/wrestlers/free-agents`, label: "Free Agents" },
      ]
    : [];
  const draftSub =
    currentLeagueSlug && !isSalaryCapLeague
      ? [
          { href: `/leagues/${currentLeagueSlug}/draft`, label: "Draft" },
          { href: `/leagues/${currentLeagueSlug}/draft-history`, label: "Draft History" },
          {
            href: `/leagues/${currentLeagueSlug}/league-settings#draft-settings-heading`,
            label: "Draft Settings",
          },
        ]
      : [];
  const gmSub = currentLeagueSlug
    ? [
        { href: `/leagues/${currentLeagueSlug}/league-settings`, label: "League Settings" },
        ...(isSalaryCapLeague
          ? []
          : [
              { href: `/leagues/${currentLeagueSlug}/pending-trades`, label: "Pending Transactions" },
              { href: `/leagues/${currentLeagueSlug}/manage-rosters`, label: "Manage Rosters" },
            ]),
        { href: `/leagues/${currentLeagueSlug}/notify-league`, label: "Notify League" },
      ]
    : [];
  const wrestlersSub = currentLeagueSlug
    ? [
        { href: `/leagues/${currentLeagueSlug}/wrestlers/league-leaders`, label: "League Leaders" },
        { href: `/leagues/${currentLeagueSlug}/wrestlers/free-agents`, label: "Free Agents" },
        { href: `/leagues/${currentLeagueSlug}/stat-corrections`, label: "Stat Corrections" },
      ]
    : [];

  /**
   * Full league strip (switcher, sections, join/create) should only appear
   * inside fantasy/league routes, not on top-level marketing/site pages.
   */
  const isFantasyRoute = pathname.startsWith("/leagues") || pathname.startsWith("/league");
  const showLeagueLowerBar = Boolean(user && leagues.length > 0 && currentLeagueSlug && isFantasyRoute);
  /** Signed in but not in any league yet: show join + create inside fantasy flows only. */
  const showNoLeagueLowerBar = Boolean(user && leagues.length === 0 && isFantasyRoute);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const fantasyMobileTab = currentLeagueSlug
    ? getFantasyMobilePrimaryTab(pathname, currentLeagueSlug, { showMatchupsInTopNav })
    : null;

  if (pathname === "/coming-soon") return null;

  return (
    <>
      <header className="nav-header" ref={mobileMenuRef}>
        <Link href="/" className="nav-header-brand-wrap">
          <img src={siteLogoHref()} alt="" className="nav-header-logo" />
          <span className="nav-header-brand nav-header-brand-full">Draftastic Pro Wrestling</span>
          <span className="nav-header-brand nav-header-brand-short" aria-hidden>Draftastic</span>
        </Link>

        <nav className="nav-top-links nav-top-links-desk" aria-label="Site">
          <Link href="/news" className="nav-top-link">News</Link>
          <Link href="/event-results" className="nav-top-link">Results</Link>
          <Link href="/wrestlers" className="nav-top-link">Wrestlers</Link>
          <Link href="/faq" className="nav-top-link">FAQ</Link>
          <Link href="/about-us" className="nav-top-link">About Us</Link>
        </nav>

        <button
          type="button"
          className="nav-mobile-menu-btn"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <svg className="nav-mobile-menu-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="nav-header-actions nav-header-actions-desk">
          {user ? (
            <div className="nav-header-actions-inner">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Link href={fantasyHref} className="nav-fantasy-pill">
                  Fantasy
                </Link>
                <Link href="/how-it-works" className="nav-top-link">
                  How It Works
                </Link>
                {isSiteAdmin ? (
                  <div className="nav-dropdown-wrap" ref={adminRef}>
                    <button
                      type="button"
                      className="nav-dropdown-trigger nav-header-admin-trigger"
                      onClick={() => setAdminOpen((o) => !o)}
                      aria-expanded={adminOpen}
                      aria-haspopup="true"
                    >
                      Admin Menu
                      <span aria-hidden>▾</span>
                    </button>
                    {adminOpen && (
                      <div className="nav-dropdown-panel" style={{ minWidth: 200 }}>
                        {ADMIN_MENU_SECTIONS.map((section) => (
                          <div key={section.title}>
                            <div className="nav-dropdown-section-title" role="presentation">
                              {section.title}
                            </div>
                            {section.links.map(({ href, label, primary }) => (
                              <Link
                                key={href}
                                href={href}
                                className={primary ? "nav-dropdown-link-primary" : undefined}
                                onClick={() => setAdminOpen(false)}
                              >
                                {label}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                <Link
                  href="/account"
                  className="nav-header-link nav-header-account"
                  title={accountHoverTitle || user.email || undefined}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  {profile?.avatar_url?.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveManagerPresetDisplayUrl(profile.avatar_url.trim())}
                      alt=""
                      width={28}
                      height={28}
                      style={{
                        borderRadius: 999,
                        objectFit: "cover",
                        border: "1px solid rgba(0,0,0,0.12)",
                      }}
                    />
                  ) : null}
                  <span>{profile?.display_name?.trim() || user.email || "Signed in"}</span>
                </Link>
                <button type="button" onClick={handleSignOut} className="nav-header-btn">
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link href="/" className="nav-header-link">Home</Link>
              <Link href={fantasyHref} className="nav-fantasy-pill">Fantasy</Link>
              <Link href="/how-it-works" className="nav-top-link">How It Works</Link>
              <Link href="/auth/sign-in" className="nav-header-link">Sign in</Link>
              <Link href={PLAY_PATH} className="nav-header-cta">Play Now</Link>
            </>
          )}
        </div>

        {mobileMenuOpen && typeof document !== "undefined" && createPortal(
          <div
            id="nav-mobile-panel"
            className="nav-mobile-panel"
            role="dialog"
            aria-label="Site menu"
          >
          <nav className="nav-mobile-panel-inner" aria-label="Site">
            <Link href="/" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              Home
            </Link>
            <Link href="/news" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              News
            </Link>
            <Link href="/event-results" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              Results
            </Link>
            <Link href="/wrestlers" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              Wrestlers
            </Link>
            <Link href="/faq" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              FAQ
            </Link>
            <Link href="/about-us" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              About Us
            </Link>
            <Link href={fantasyHref} className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              Fantasy
            </Link>
            <Link href="/how-it-works" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
              How It Works
            </Link>
            <Link
              href={PLAY_PATH}
              className={`nav-mobile-panel-cta${pathname === PLAY_PATH ? " is-active" : ""}`}
              onClick={closeMobileMenu}
            >
              Play Now
            </Link>
            {isSiteAdmin
              ? ADMIN_MENU_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <p className="nav-mobile-admin-section-title">{section.title}</p>
                    {section.links.map(({ href, label }) => (
                      <Link key={href} href={href} className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                        {label}
                      </Link>
                    ))}
                  </div>
                ))
              : null}
          </nav>
          <div className="nav-mobile-panel-actions">
            {user ? (
              <>
                <Link
                  href="/account"
                  className="nav-mobile-panel-link"
                  onClick={closeMobileMenu}
                  title={accountHoverTitle || user.email || undefined}
                >
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
                <Link href={PLAY_PATH} className="nav-mobile-panel-outline-cta" onClick={closeMobileMenu}>
                  Play Now
                </Link>
              </>
            )}
          </div>
          </div>,
          document.body
        )}
      </header>

      {showNoLeagueLowerBar && (
        <div
          className="nav-lower-bar"
          onMouseLeave={handleLowerBarLeave}
          onMouseEnter={handleLowerBarEnter}
        >
          <nav className="nav-primary-wrap" aria-label="Fantasy">
            <ul className="nav-primary-list">
              <li>
                <span className="nav-secondary-label" style={{ paddingLeft: 0 }}>
                  You&apos;re not in a league yet
                </span>
              </li>
              <li className="nav-primary-item-create-league">
                <div className="nav-primary-create-join-group" role="group" aria-label="League actions">
                  <Link href={PLAY_PATH} className={`nav-primary-link-join ${pathname === PLAY_PATH ? "is-active" : ""}`}>
                    Play Now
                  </Link>
                </div>
              </li>
            </ul>
          </nav>
          <nav className="nav-secondary-wrap" aria-label="Get started">
            <ul className="nav-secondary-list">
              <li>
                <span className="nav-secondary-context">
                  Join a public league or create your own — start with Play Now.
                </span>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {showLeagueLowerBar && (
        <div
          className="nav-lower-bar"
          onMouseLeave={handleLowerBarLeave}
          onMouseEnter={handleLowerBarEnter}
        >
          <nav className="nav-primary-wrap nav-league-desktop" aria-label="League">
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
                      </div>,
                      document.body
                    )}
                </div>
              </li>
              <li onMouseEnter={(e) => handlePrimaryEnter("league", e)}>
                <Link
                  href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}` : "#"}
                  className={`nav-primary-link ${activePrimary === "league" ? "is-active" : ""}`}
                >
                  League
                </Link>
              </li>
              <li onMouseEnter={(e) => handlePrimaryEnter("my-team", e)}>
                <Link
                  href={desktopMyFactionHref}
                  className={`nav-primary-link ${activePrimary === "my-team" ? "is-active" : ""}`}
                >
                  My Faction
                </Link>
              </li>
              <li onMouseEnter={(e) => handlePrimaryEnter("wrestlers", e)}>
                <Link
                  href={wrestlersSub[0]?.href ?? (currentLeagueSlug ? `/leagues/${currentLeagueSlug}/wrestlers/league-leaders` : "#")}
                  prefetch={false}
                  className={`nav-primary-link ${activePrimary === "wrestlers" ? "is-active" : ""}`}
                >
                  Statistics
                </Link>
              </li>
              {currentLeague && leagueShowsMatchupsInNav(currentLeague.league_type) && (
                <li>
                  <Link
                    href={currentLeagueSlug ? `/leagues/${currentLeagueSlug}/matchups` : "#"}
                    className={`nav-primary-link ${activePrimary === "matchups" ? "is-active" : ""}`}
                  >
                    Matchups
                  </Link>
                </li>
              )}
              <li onMouseEnter={(e) => handlePrimaryEnter("ple", e)}>
                <Link
                  href={pleBarHref}
                  className={`nav-primary-link ${activePrimary === "ple" ? "is-active" : ""}`}
                >
                  PLEs
                </Link>
              </li>
              {!isSalaryCapLeague && (
                <li onMouseEnter={(e) => handlePrimaryEnter("draft", e)}>
                  <Link
                    href={draftSub[0]?.href ?? (currentLeagueSlug ? `/leagues/${currentLeagueSlug}/draft` : "#")}
                    className={`nav-primary-link ${activePrimary === "draft" ? "is-active" : ""}`}
                  >
                    Draft
                  </Link>
                </li>
              )}
              {isCommissioner && (
                <li onMouseEnter={(e) => handlePrimaryEnter("gm-tools", e)}>
                  <Link
                    href={gmSub[0]?.href ?? (currentLeagueSlug ? `/leagues/${currentLeagueSlug}/league-settings` : "#")}
                    className={`nav-primary-link ${activePrimary === "gm-tools" ? "is-active" : ""}`}
                  >
                    GM Tools
                  </Link>
                </li>
              )}
              <li className="nav-primary-item-create-league">
                <div className="nav-primary-create-join-group" role="group" aria-label="League actions">
                  <Link href={PLAY_PATH} className={`nav-primary-link-join ${pathname === PLAY_PATH ? "is-active" : ""}`}>
                    Play Now
                  </Link>
                </div>
              </li>
            </ul>
          </nav>

          <nav className="nav-secondary-wrap nav-league-desktop" aria-label="Section" ref={secondaryWrapRef}>
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
              {(hoverPrimary ?? activePrimary) === "draft" && !isSalaryCapLeague &&
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
              {(hoverPrimary ?? activePrimary) === "matchups" && leagueShowsMatchupsInNav(currentLeague?.league_type) && (
                <li>
                  <span className="nav-secondary-context">Matchups</span>
                </li>
              )}
              {(hoverPrimary ?? activePrimary) === "ple" &&
                currentLeagueSlug &&
                pleNavItems.map((entry) => {
                  const href = pleHrefForEntry(currentLeagueSlug, entry);
                  const active = pleEntryIsActive(entry);
                  return (
                    <li key={entry.kind === "wrestlemania" ? "ple-wm" : `ple-${entry.pathKey}`}>
                      <Link href={href} className={`nav-secondary-link ${active ? "is-active" : ""}`}>
                        {entry.label}
                      </Link>
                    </li>
                  );
                })}
              {(hoverPrimary ?? activePrimary) === "wrestlers" &&
                wrestlersSub.map(({ href, label }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <li key={href}>
                      <Link href={href} prefetch={false} className={`nav-secondary-link ${isActive ? "is-active" : ""}`}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              {!(hoverPrimary ?? activePrimary) && showLeagueLowerBar && (
                <li>
                  <span className="nav-secondary-context">League</span>
                </li>
              )}
            </ul>
          </nav>

          <div className="nav-league-mobile" aria-label="League navigation">
            <div className="nav-league-mobile-row">
              <label className="nav-league-mobile-label" htmlFor="mobile-league-switcher">
                League
              </label>
              <select
                id="mobile-league-switcher"
                className="nav-league-mobile-select nav-league-mobile-select-on-dark"
                value={currentLeagueSlug ?? ""}
                onChange={(e) => {
                  const nextSlug = e.target.value;
                  if (!nextSlug) return;
                  try {
                    localStorage.setItem(LAST_LEAGUE_KEY, nextSlug);
                  } catch {
                    /* ignore */
                  }
                  router.push(`/leagues/${nextSlug}`);
                }}
              >
                {leagues.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.name}{l.role === "commissioner" ? " (GM)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {currentLeagueSlug && user?.id ? (
              <nav className="nav-fantasy-mobile-tabs" aria-label="Fantasy sections">
                <Link
                  href={`/leagues/${currentLeagueSlug}`}
                  className={`nav-fantasy-mobile-tab ${fantasyMobileTab === "league" ? "is-active" : ""}`}
                >
                  League
                </Link>
                <Link
                  href={`/leagues/${currentLeagueSlug}/faction`}
                  className={`nav-fantasy-mobile-tab ${fantasyMobileTab === "faction" ? "is-active" : ""}`}
                >
                  Faction
                </Link>
                {showMatchupsInTopNav ? (
                  <Link
                    href={`/leagues/${currentLeagueSlug}/matchups`}
                    className={`nav-fantasy-mobile-tab ${fantasyMobileTab === "matchups" ? "is-active" : ""}`}
                  >
                    Matchups
                  </Link>
                ) : null}
                <Link
                  href={`/leagues/${currentLeagueSlug}/wrestlers/league-leaders`}
                  prefetch={false}
                  className={`nav-fantasy-mobile-tab ${fantasyMobileTab === "wrestlers" ? "is-active" : ""}`}
                >
                  Wrestlers
                </Link>
                {!isSalaryCapLeague && !showMatchupsInTopNav ? (
                  <Link
                    href={`/leagues/${currentLeagueSlug}/draft`}
                    className={`nav-fantasy-mobile-tab ${fantasyMobileTab === "draft" ? "is-active" : ""}`}
                  >
                    Draft
                  </Link>
                ) : null}
              </nav>
            ) : null}

          </div>
        </div>
      )}
    </>
  );
}
