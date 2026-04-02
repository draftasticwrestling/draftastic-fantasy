-- Optional narrative fields synced from Pro Wrestling Boxscore (event detail header).
alter table public.events
  add column if not exists preview text null;

alter table public.events
  add column if not exists recap text null;
