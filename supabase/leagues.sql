/* Leagues: user-created leagues with commissioner and members.
   league_invites: token-based invite links. Join via function. */

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  commissioner_id uuid not null references auth.users on delete cascade,
  start_date date null,
  end_date date null,
  created_at timestamptz not null default now()
);

comment on table public.leagues is 'Fantasy league. commissioner_id is the creator; members in league_members.';

create index if not exists idx_leagues_slug on public.leagues (slug);
create index if not exists idx_leagues_commissioner on public.leagues (commissioner_id);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner' check (role in ('commissioner', 'owner')),
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

comment on table public.league_members is 'League membership. One row per user per league.';

create index if not exists idx_league_members_league on public.league_members (league_id);
create index if not exists idx_league_members_user on public.league_members (user_id);

create table if not exists public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.league_invites is 'Invite link tokens. Use join_league_with_token() to join.';

create index if not exists idx_league_invites_token on public.league_invites (token);
create index if not exists idx_league_invites_league on public.league_invites (league_id);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_invites enable row level security;

/* Helper: is the current user a member of this league? (Security definer avoids RLS recursion.) */
create or replace function public.current_user_is_league_member(p_league_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

-- Leagues: members can read; authenticated can create; commissioner can update/delete.
create policy "League members can read league"
  on public.leagues for select
  to authenticated
  using (
    exists (
      select 1 from public.league_members m
      where m.league_id = leagues.id and m.user_id = auth.uid()
    )
  );

-- Any authenticated user can create a league; app always sets commissioner_id to current user.
create policy "Authenticated can create league"
  on public.leagues for insert
  to authenticated
  with check (true);

create policy "Commissioner can update league"
  on public.leagues for update
  to authenticated
  using (commissioner_id = auth.uid())
  with check (commissioner_id = auth.uid());

create policy "Commissioner can delete league"
  on public.leagues for delete
  to authenticated
  using (commissioner_id = auth.uid());

-- League members: members of a league can read that league's members; commissioner can insert; user can delete own row (leave).
-- (Use function to avoid RLS infinite recursion when policy queries same table.)
create policy "League members can read members"
  on public.league_members for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

create policy "Commissioner can add member"
  on public.league_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_members.league_id and l.commissioner_id = auth.uid()
    )
  );

create policy "User can leave league"
  on public.league_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Invites: members of the league can read invites for that league; commissioner can insert/delete. Join is via function.
create policy "League members can read invites"
  on public.league_invites for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

create policy "Commissioner can create invite"
  on public.league_invites for insert
  to authenticated
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_invites.league_id and l.commissioner_id = auth.uid()
    )
  );

create policy "Commissioner can delete invite"
  on public.league_invites for delete
  to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_invites.league_id and l.commissioner_id = auth.uid()
    )
  );

/* Join a league using an invite token. Call as the authenticated user who is joining.
   Adds them as a member and deletes the invite. */
create or replace function public.join_league_with_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.league_invites;
  v_league public.leagues;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select * into v_invite
  from public.league_invites
  where token = p_token and expires_at > now()
  limit 1;

  if v_invite.id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired invite link');
  end if;

  select * into v_league from public.leagues where id = v_invite.league_id;
  if v_league.id is null then
    return jsonb_build_object('ok', false, 'error', 'League not found');
  end if;

  -- Already a member?
  if exists (select 1 from public.league_members where league_id = v_invite.league_id and user_id = v_uid) then
    delete from public.league_invites where id = v_invite.id;
    return jsonb_build_object('ok', true, 'league_slug', v_league.slug, 'message', 'Already in league');
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_invite.league_id, v_uid, 'owner');

  delete from public.league_invites where id = v_invite.id;

  return jsonb_build_object('ok', true, 'league_slug', v_league.slug);
end;
$$;
