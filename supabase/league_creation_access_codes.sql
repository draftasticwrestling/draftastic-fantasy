/* Beta league-creation access codes with usage caps.
   Non-admin league creation should consume one usage atomically. */

create table if not exists public.league_creation_access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  max_uses int not null check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.league_creation_access_codes is
  'Beta access codes used to unlock league creation for non-admin users.';

comment on column public.league_creation_access_codes.code is
  'Human-entered access code. Store as plain text so support can communicate it to users.';

alter table public.league_creation_access_codes enable row level security;

drop policy if exists "No direct access to league creation access codes" on public.league_creation_access_codes;
create policy "No direct access to league creation access codes"
  on public.league_creation_access_codes
  for all
  to authenticated
  using (false)
  with check (false);

create or replace function public.consume_league_creation_access_code(p_code text)
returns table (
  ok boolean,
  error text,
  remaining_uses int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.league_creation_access_codes%rowtype;
begin
  select *
  into v_row
  from public.league_creation_access_codes
  where code = trim(coalesce(p_code, ''))
    and is_active = true
  for update;

  if not found then
    return query select false, 'Invalid access code.', 0;
    return;
  end if;

  if v_row.used_count >= v_row.max_uses then
    return query select false, 'That access code has reached its usage limit.', 0;
    return;
  end if;

  update public.league_creation_access_codes
  set used_count = used_count + 1,
      updated_at = now()
  where id = v_row.id;

  return query
    select true, null::text, greatest(v_row.max_uses - (v_row.used_count + 1), 0);
end;
$$;

grant execute on function public.consume_league_creation_access_code(text) to authenticated;

/* Existence check for UI (RLS blocks direct SELECT on the table). */
create or replace function public.league_creation_access_codes_configured()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.league_creation_access_codes
    where is_active = true
    limit 1
  );
$$;

grant execute on function public.league_creation_access_codes_configured() to authenticated;

-- Example seed (choose your own code):
-- insert into public.league_creation_access_codes (code, max_uses, is_active)
-- values ('SUMMERSLAM-BETA-2026', 125, true);
