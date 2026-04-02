-- Optional columns so title history can match Pro Wrestling Boxscore (defeated, events).
-- Safe to run once; Boxscore may already use these or different names — the app also reads
-- several aliases (see lib/championshipTitleHistory.ts reignDetailsFromRow).

alter table championship_history add column if not exists defeated text;
alter table championship_history add column if not exists defeated_slug text;
alter table championship_history add column if not exists event_won text;
alter table championship_history add column if not exists event_lost text;
