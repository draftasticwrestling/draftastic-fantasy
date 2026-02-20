"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/profiles";

const TOP_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leagues", label: "Leagues" },
  { href: "/league/teams", label: "League" },
  { href: "/mvl", label: "MVL Example" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/wrestlers", label: "Wrestlers" },
  { href: "/score", label: "Score event" },
] as const;

const LEAGUE_SUB_LINKS = [
  { href: "/league/teams", label: "Teams" },
  { href: "/league/draft", label: "Draft" },
  { href: "/league/trades", label: "Trades" },
  { href: "/league/free-agents", label: "Free Agents" },
] as const;

function getSecondaryLabel(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname === "/leagues" || pathname.startsWith("/leagues/")) return "Leagues";
  if (pathname === "/league" || pathname === "/league/teams") return "League · Teams";
  if (pathname === "/league/draft") return "League · Draft";
  if (pathname === "/league/trades") return "League · Trades";
  if (pathname === "/league/free-agents") return "League · Free Agents";
  if (pathname.startsWith("/league/")) return "Team";
  if (pathname.startsWith("/how-it-works")) return "How it works";
  if (pathname.startsWith("/wrestlers")) return "Wrestlers";
  if (pathname.startsWith("/score")) return "Score event";
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
      {/* Top bar - dark */}
      <header
        style={{
          background: "#1a2332",
          color: "#fff",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            color: "inherit",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "1.1rem",
          }}
        >
          Draftastic Fantasy
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.9rem" }}>
          {user ? (
            <>
              <Link
                href="/account"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  textDecoration: "none",
                  padding: "6px 0",
                }}
                title={user.email ?? undefined}
              >
                {profile?.display_name?.trim() || user.email || "Signed in"}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.5)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" style={{ color: "#fff", textDecoration: "none", padding: "6px 0" }}>
                Sign in
              </Link>
              <Link
                href="/auth/sign-up"
                style={{
                  color: "#1a2332",
                  background: "#fff",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontWeight: 500,
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Primary nav - light grey */}
      <nav
        style={{
          background: "#e8ecef",
          borderBottom: "1px solid #d0d5db",
          padding: "0 24px",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            alignItems: "center",
            minHeight: 40,
          }}
        >
          {TOP_LINKS.map(({ href, label }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  style={{
                    color: isActive ? "#1a73e8" : "#333",
                    textDecoration: "none",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: "0.95rem",
                    padding: "10px 0",
                    display: "block",
                    borderBottom: isActive ? "2px solid #1a73e8" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Secondary nav - white, context links or league sub-menu */}
      <nav
        style={{
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
          padding: "0 24px",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            gap: 20,
            alignItems: "center",
            minHeight: 36,
            fontSize: "0.9rem",
          }}
        >
          {pathname.startsWith("/league") ? (
            LEAGUE_SUB_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || (href === "/league/teams" && pathname === "/league");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    style={{
                      color: isActive ? "#1a73e8" : "#333",
                      textDecoration: "none",
                      fontWeight: isActive ? 600 : 400,
                      padding: "8px 0",
                      display: "block",
                      borderBottom: isActive ? "2px solid #1a73e8" : "2px solid transparent",
                      marginBottom: -1,
                    }}
                  >
                    {label}
                  </Link>
                </li>
              );
            })
          ) : (
            <li>
              <span style={{ color: "#111", fontWeight: 600 }}>{secondaryLabel}</span>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}
