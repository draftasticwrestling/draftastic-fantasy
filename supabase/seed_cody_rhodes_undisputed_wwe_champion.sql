-- Cody Rhodes won the Undisputed WWE Championship from Drew McIntyre on 2026-03-06.
-- Run this in Supabase SQL editor to set Cody as current champion (for profile gold box + belt overlay).

-- End Drew McIntyre's reign on the title (if such a row exists).
update championship_history
set lost_date = '2026-03-06', end_date = '2026-03-06'
where (champion_slug = 'drew-mcintyre' or champion_id = 'drew-mcintyre' or lower(coalesce(champion_name, champion, '')) like '%drew mcintyre%')
  and (lower(coalesce(title, title_name, '')) like '%undisputed%wwe%' or lower(coalesce(title, title_name, '')) like '%wwe%undisputed%')
  and (lost_date is null and end_date is null);

-- Insert Cody Rhodes as current Undisputed WWE Champion (won 2026-03-06).
insert into championship_history (champion_slug, champion_id, champion_name, champion, title, title_name, won_date, start_date, lost_date, end_date)
values (
  'cody-rhodes',
  'cody-rhodes',
  'Cody Rhodes',
  'Cody Rhodes',
  'Undisputed WWE Championship',
  'Undisputed WWE Championship',
  '2026-03-06',
  '2026-03-06',
  null,
  null
)
on conflict do nothing;
