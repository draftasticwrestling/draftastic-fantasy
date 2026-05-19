-- PWBS event-level special winner (Royal Rumble winner, etc.) as JSON { "type", "name" }.
-- Run in Supabase SQL editor before using Advanced → Special match winner in boxscore admin.
alter table public.events
  add column if not exists "specialWinner" jsonb null;

comment on column public.events."specialWinner" is
  'Optional event-level special winner from PWBS admin ({ type, name }).';
