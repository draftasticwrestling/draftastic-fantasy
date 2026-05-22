-- Rename Road to Survivor Series season slug to Road to War Games.

update public.leagues
set season_slug = 'road-to-war-games'
where season_slug = 'road-to-survivor-series';

comment on column public.leagues.season_slug is 'Standard season: road-to-summerslam, road-to-war-games, road-to-wrestlemania, chamber-to-mania, public-salary-cap.';
