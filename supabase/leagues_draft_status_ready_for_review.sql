-- Allow autopick drafts to transition into review state before final approval.
-- Existing app code uses: not_started -> in_progress -> ready_for_review -> completed.

alter table public.leagues
  drop constraint if exists leagues_draft_status_check;

alter table public.leagues
  add constraint leagues_draft_status_check
  check (draft_status in ('not_started', 'in_progress', 'ready_for_review', 'completed'));

comment on column public.leagues.draft_status is
  'not_started | in_progress | ready_for_review | completed.';
