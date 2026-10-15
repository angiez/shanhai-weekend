-- Shanhai Weekend community schema.
-- Run this only in a new Supabase project created in ca-central-1.
-- Do not run it on a United States project.
-- Do not put the service role key in the website.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  place_id text not null check (char_length(place_id) between 1 and 80),
  place_label text not null check (char_length(place_label) between 1 and 120),
  starts_at timestamptz not null,
  meeting_point text not null check (char_length(meeting_point) between 1 and 160),
  capacity int not null check (capacity between 2 and 12),
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.registrations (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.registrations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create or replace function public.confirmed_count(aid uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.registrations
  where activity_id = aid and status = 'confirmed';
$$;

create or replace function public.is_confirmed(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.registrations
    where activity_id = aid and user_id = auth.uid() and status = 'confirmed'
  );
$$;

create or replace function public.chat_open(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.confirmed_count(aid) >= 2
    and exists (
      select 1 from public.activities
      where id = aid and status = 'open'
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), '家人'), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.guard_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  st text;
  n int;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'registration must belong to the signed-in user';
  end if;
  select capacity, status into cap, st
  from public.activities
  where id = new.activity_id
  for update;
  if st is distinct from 'open' then
    raise exception 'activity is not open';
  end if;
  if new.status = 'confirmed' then
    select count(*) into n from public.registrations
    where activity_id = new.activity_id and status = 'confirmed' and user_id <> new.user_id;
    if n >= cap then
      raise exception 'activity is full';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_guard on public.registrations;
create trigger registrations_guard
  before insert or update on public.registrations
  for each row execute function public.guard_registration();

drop view if exists public.activity_people;
create view public.activity_people
with (security_invoker = true) as
select r.activity_id, p.display_name, r.created_at
from public.registrations r
join public.profiles p on p.id = r.user_id
where r.status = 'confirmed';

revoke all on public.activity_people from public, anon;
grant select on public.activity_people to authenticated;

drop view if exists public.activity_counts;
create view public.activity_counts
with (security_invoker = false) as
select activity_id, count(*)::int as participants
from public.registrations
where status = 'confirmed'
group by activity_id;

revoke all on public.activity_counts from public;
grant select on public.activity_counts to anon, authenticated;

drop policy if exists activities_read on public.activities;
create policy activities_read on public.activities
  for select to anon, authenticated using (true);

drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert to authenticated with check (creator_id = auth.uid());

drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities
  for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.registrations mine
      join public.registrations theirs on theirs.activity_id = mine.activity_id
      where mine.user_id = auth.uid()
        and mine.status = 'confirmed'
        and theirs.user_id = profiles.id
        and theirs.status = 'confirmed'
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists registrations_select on public.registrations;
create policy registrations_select on public.registrations
  for select to authenticated
  using (public.is_confirmed(activity_id) or user_id = auth.uid());

drop policy if exists registrations_write on public.registrations;
create policy registrations_write on public.registrations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists registrations_update on public.registrations;
create policy registrations_update on public.registrations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create schema if not exists private;

create or replace function private.blocked_pair(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = other)
       or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.blocked_pair(uuid) from public, anon;
grant execute on function private.blocked_pair(uuid) to authenticated;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.chat_open(activity_id)
    and public.is_confirmed(activity_id)
    and not private.blocked_pair(messages.user_id)
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.chat_open(activity_id)
    and public.is_confirmed(activity_id)
  );

drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

revoke all on table public.profiles from public, anon;
revoke all on table public.activities from public;
revoke all on table public.registrations from public, anon;
revoke all on table public.messages from public, anon;
revoke all on table public.blocks from public, anon;
revoke all on table public.reports from public, anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.activities to anon, authenticated;
grant insert, update on table public.activities to authenticated;
grant select, insert, update on table public.registrations to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert on table public.blocks to authenticated;
grant insert on table public.reports to authenticated;

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.deletion_requests enable row level security;

drop policy if exists deletion_insert on public.deletion_requests;
create policy deletion_insert on public.deletion_requests
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists deletion_select on public.deletion_requests;
create policy deletion_select on public.deletion_requests
  for select to authenticated using (user_id = auth.uid());

revoke all on table public.deletion_requests from public, anon;
grant select, insert on table public.deletion_requests to authenticated;

revoke all on function public.confirmed_count(uuid) from public, anon;
revoke all on function public.is_confirmed(uuid) from public, anon;
revoke all on function public.chat_open(uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_registration() from public, anon, authenticated;
grant execute on function public.confirmed_count(uuid) to authenticated;
grant execute on function public.is_confirmed(uuid) to authenticated;
grant execute on function public.chat_open(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
