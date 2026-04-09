"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  computeFantasyHomeHref,
  type FantasyLeagueItem,
  getLeagueSlugFromPath,
} from "@/lib/fantasyHomeHref";

const LAST_LEAGUE_KEY = "draftastic_last_league_slug";

/** Mirrors Nav league memory + `/api/me/leagues` so hub Quick links match the Fantasy button. */
export function useFantasyHomeHref(): string {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [leagues, setLeagues] = useState<FantasyLeagueItem[]>([]);
  const [lastVisitedSlug, setLastVisitedSlug] = useState<string | null>(null);

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
      setLeagues([]);
      return;
    }
    fetch("/api/me/leagues")
      .then((r) => r.json())
      .then((data) => {
        const list = (data?.leagues ?? []) as FantasyLeagueItem[];
        setLeagues(list);
        try {
          const last = localStorage.getItem(LAST_LEAGUE_KEY);
          if (last && list.some((l) => l.slug === last)) setLastVisitedSlug(last);
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

  return computeFantasyHomeHref({ user, pathname, leagues, lastVisitedSlug });
}
