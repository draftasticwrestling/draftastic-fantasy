-- Prevent duplicate title-history reigns for the same champion + date won.
-- Step 1 removes existing duplicates (keeps the lowest id per champion + date),
-- then Step 2 adds the unique index so new duplicates are rejected by the DB.
-- Safe to re-run.

-- Step 1: delete duplicate reigns, keeping the oldest row for each
-- (championship_id, champion, date_won) group.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY championship_id, lower(trim(champion)), date_won::date
      ORDER BY id
    ) AS rn
  FROM championship_history
)
DELETE FROM championship_history
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: enforce uniqueness going forward.
DROP INDEX IF EXISTS championship_history_unique_reign;

CREATE UNIQUE INDEX championship_history_unique_reign
  ON championship_history (championship_id, lower(trim(champion)), (date_won::date));
