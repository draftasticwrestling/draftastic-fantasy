-- Optional: seed NXT / PLE event-type labels for boxscore_ui_options (merged with code defaults).
-- Safe to re-run (on conflict do nothing).

insert into public.boxscore_ui_options (category, label, sort_order)
values
  ('event_type', 'WWE NXT', 10),
  ('event_type', 'NXT Stand and Deliver', 11),
  ('event_type', 'NXT Deadline', 12),
  ('event_type', 'NXT Battleground', 13),
  ('event_type', 'NXT The Great American Bash', 14),
  ('event_type', 'NXT No Mercy', 15),
  ('event_type', 'NXT Halloween Havoc', 16),
  ('event_type', 'NXT Heatwave', 17),
  ('event_type', 'NXT Vengeance Day', 18),
  ('event_type', 'NXT New Year''s Evil', 19),
  ('event_type', 'NXT Showdown', 20),
  ('event_type', 'NXT Gold Rush', 21),
  ('event_type', 'NXT Roadblock', 22),
  ('event_type', 'NXT Homecoming', 23),
  ('event_type', 'NXT Revenge', 24)
on conflict (category, label) do nothing;
