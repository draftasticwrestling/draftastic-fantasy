-- Faction logo as allowlisted emoji (see lib/factionEmoji.ts). Null = default 🏆 in UI.
-- Run in Supabase SQL Editor if the app reports a missing faction_emoji column.

alter table public.league_members
  add column if not exists faction_emoji text null;

comment on column public.league_members.faction_emoji is 'Owner-selected faction emoji from app allowlist; null uses default trophy in UI.';
