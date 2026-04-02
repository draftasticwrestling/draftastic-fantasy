-- Optional: mirrors Pro Wrestling Boxscore (see wrestling-boxscore/add_wrestler_profile_columns.sql).
-- Accomplishments on /wrestler/[slug] are read from this column (newline-separated lines).

ALTER TABLE public.wrestlers ADD COLUMN IF NOT EXISTS accomplishments TEXT;

COMMENT ON COLUMN public.wrestlers.accomplishments IS
  'Career highlights for profile (plain text, line-separated); same source as prowrestlingboxscore.com wrestler pages.';
