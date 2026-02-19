/* Seed Christopher Cramer's Season 3 discovery holdings (example league).
   Discovery 1: JC Mateo - debuted May 10, 2025, added to roster May 11, 2025.
   Discovery 2: Mara Sade - rights held (no debut yet).
   Discovery 3: Noam Dar - rights held (no debut yet). */

/* Ensure JC Mateo exists in wrestlers (for roster). */
insert into wrestlers (id, name)
values ('jc-mateo', 'JC Mateo')
on conflict (id) do update set name = coalesce(excluded.name, wrestlers.name);

/* Add JC Mateo to Christopher Cramer's roster (3 yr from Discovery 1). */
insert into roster_assignments (league_slug, owner_slug, wrestler_id, contract)
values ('example', 'christopher-cramer', 'jc-mateo', '3 yr')
on conflict (league_slug, owner_slug, wrestler_id) do update set contract = '3 yr';

/* Discovery holding for pick #1 - JC Mateo (debut + activated). */
insert into discovery_holdings (league_slug, owner_slug, draft_pick_id, wrestler_name, company, debut_date, activated_at)
select 'example', 'christopher-cramer', id, 'JC Mateo', null, '2025-05-10', '2025-05-11T12:00:00Z'
from draft_picks
where league_slug = 'example' and season = 3 and current_owner_slug = 'christopher-cramer'
  and pick_type = 'discovery' and discovery_number = 1
  and not exists (select 1 from discovery_holdings where draft_pick_id = draft_picks.id);

/* Discovery holding for pick #2 - Mara Sade. */
insert into discovery_holdings (league_slug, owner_slug, draft_pick_id, wrestler_name, company, debut_date, activated_at)
select 'example', 'christopher-cramer', id, 'Mara Sade', null, null, null
from draft_picks
where league_slug = 'example' and season = 3 and current_owner_slug = 'christopher-cramer'
  and pick_type = 'discovery' and discovery_number = 2
  and not exists (select 1 from discovery_holdings where draft_pick_id = draft_picks.id);

/* Discovery holding for pick #3 - Noam Dar. */
insert into discovery_holdings (league_slug, owner_slug, draft_pick_id, wrestler_name, company, debut_date, activated_at)
select 'example', 'christopher-cramer', id, 'Noam Dar', null, null, null
from draft_picks
where league_slug = 'example' and season = 3 and current_owner_slug = 'christopher-cramer'
  and pick_type = 'discovery' and discovery_number = 3
  and not exists (select 1 from discovery_holdings where draft_pick_id = draft_picks.id);

/* Mark Christopher Cramer's 3 discovery picks as used. */
update draft_picks
set used_at = coalesce(used_at, now())
where league_slug = 'example' and season = 3 and current_owner_slug = 'christopher-cramer'
  and pick_type = 'discovery' and discovery_number in (1, 2, 3);
