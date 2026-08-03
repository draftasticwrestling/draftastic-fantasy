-- Interim / inactive dual-reign support for championship_history.
-- Allowed app values: null | 'sole' | 'interim' | 'inactive_injured'
-- Run in Supabase before deploying interim title-reign admin/UI.

alter table public.championship_history
  add column if not exists reign_kind text;
