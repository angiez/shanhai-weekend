-- Migration for the Canadian project shanhai-weekend-ca in ca-central-1 only.
-- Do not run this on the paused United States project.
-- Do not put a secret key or the service role key in the website.
-- Do not apply this file until the revised schema has been reviewed.
-- After a reviewed run, set the Auth site URL to https://weekend.bchomehub.com,
-- allow redirect https://weekend.bchomehub.com/account/, and keep email confirmation on.
--
-- Public discovery exposes title, place, time, capacity, status, and participant counts.
-- Meeting points and creator ids are not publicly readable.
-- A meeting point is returned only to a confirmed participant while the activity is open.
-- Reports are readable only by the database owner in the Supabase dashboard.
-- The owner deletes report rows older than 12 months with private.purge_old_reports().
-- Evidence for a resolved report is deleted immediately by trigger. A stored
-- user id or message body is still personal information.
-- Account deletion is three owner-only steps. None of them UPDATE, INSERT, or
-- DELETE auth.users, auth.identities, or auth.sessions.
--   1. select private.prepare_deletion('<request-id>');
--      Releases shared activities, blocks the profile, and writes an audit row
--      with auth_status pending. Running it again returns the same outcome and
--      does not repeat the deletes. fulfilled_at stays empty.
--   2. Auth Admin API on gcpeteqilwvnlvfrbncd only, service role, never from
--      the website. Read private.deletion_audit.auth_action:
--        soft_delete: auth.admin.deleteUser(userId, true)
--          keeps the auth row, sets deleted_at, revokes sessions, blocks sign-in.
--        delete: auth.admin.deleteUser(userId)
--          removes the login. Do this only after prepare_deletion.
--      ban_duration does not revoke sessions, so it is not this step.
--      If the call fails: select private.record_auth_failure('<request-id>', 'short reason');
--      then retry the same Auth Admin call. Do not run prepare_deletion again.
--      The note must be a short reason, never a key.
--   3. select private.complete_deletion('<request-id>');
--      This marks the audit succeeded only after the supported Admin API result
--      is visible: the auth row is gone, or auth.users.deleted_at is set.
--      It only reads that column. It does not write to the auth schema.
--      Until this returns, the deletion is not fully completed.
-- If the person created an activity that anyone else joined, the activity is
-- cancelled and creator_id moves to the earliest other participant. Other
-- people's registrations and messages stay. An activity that only the person
-- joined is removed on a full delete.
-- An open safety report keeps the profile, stores the user id and message body
-- in private.report_evidence, and blocks the profile. That copy is still
-- personal information and is visible only to the database owner, until the
-- report is resolved or private.purge_old_reports() deletes it at 12 months.
-- An access token already issued stays valid until exp. access_revoked makes
-- row level security deny that account on the next request, including Realtime.
-- The private schema stays out of the Data API exposed schemas.
-- Never put the service-role key in frontend code.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  access_revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete restrict,
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
  reporter_id uuid not null references public.profiles (id) on delete restrict,
  activity_id uuid references public.activities (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  check (activity_id is not null or message_id is not null)
);

create unique index if not exists reports_one_message
  on public.reports (reporter_id, message_id)
  where message_id is not null;

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.registrations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create schema if not exists private;

create or replace function public.confirmed_count(aid uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.registrations
  where activity_id = aid and status = 'confirmed';
$$;

create or replace function public.is_confirmed(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
set search_path = ''
as $$
  select public.confirmed_count(aid) >= 2
    and exists (
      select 1 from public.activities
      where id = aid and status = 'open'
    );
$$;

create or replace function public.participant_counts()
returns table(activity_id uuid, participants int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.activity_id, count(*)::int
  from public.registrations r
  where r.status = 'confirmed'
  group by r.activity_id;
$$;

create or replace function public.participant_meeting(aid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.meeting_point
  from public.activities a
  where a.id = aid
    and a.status = 'open'
    and public.is_confirmed(aid);
$$;

create or replace function public.caller_is_creator(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activities a
    where a.id = aid and a.creator_id = auth.uid()
  );
$$;

create or replace function public.access_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.access_revoked = false
  );
$$;

create or replace function private.blocked_pair(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = other)
       or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

create or replace function private.no_unblocked_peer(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_confirmed(aid)
    and not exists (
      select 1 from public.registrations r
      where r.activity_id = aid
        and r.status = 'confirmed'
        and r.user_id <> auth.uid()
        and not private.blocked_pair(r.user_id)
    );
$$;

create or replace function public.messages_paused(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.no_unblocked_peer(aid);
$$;

create or replace function private.report_allowed(aid uuid, mid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select aid is not null
    and public.is_confirmed(aid)
    and exists (select 1 from public.activities a where a.id = aid)
    and (
      mid is null
      or exists (
        select 1 from public.messages m
        where m.id = mid and m.activity_id = aid
      )
    )
    and (
      select count(*) from public.reports r
      where r.reporter_id = auth.uid()
        and r.created_at > now() - interval '24 hours'
    ) < 5;
$$;

create or replace function private.purge_old_reports()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  delete from public.reports
  where created_at < now() - interval '12 months';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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
set search_path = ''
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

drop view if exists public.activity_counts;
drop view if exists public.activity_people;
create view public.activity_people
with (security_invoker = true) as
select r.activity_id, p.display_name
from public.registrations r
join public.profiles p on p.id = r.user_id
where r.status = 'confirmed';

revoke all on public.activity_people from public, anon;
grant select on public.activity_people to authenticated;

drop policy if exists activities_read on public.activities;
create policy activities_read on public.activities
  for select to anon, authenticated using (true);

drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert to authenticated
  with check (creator_id = auth.uid() and public.access_open());

drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities
  for update to authenticated
  using (creator_id = auth.uid() and public.access_open())
  with check (creator_id = auth.uid() and public.access_open());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      public.access_open()
      and exists (
        select 1 from public.registrations mine
        join public.registrations theirs on theirs.activity_id = mine.activity_id
        where mine.user_id = auth.uid()
          and mine.status = 'confirmed'
          and theirs.user_id = profiles.id
          and theirs.status = 'confirmed'
      )
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.access_open())
  with check (id = auth.uid() and public.access_open());

drop policy if exists registrations_select on public.registrations;
create policy registrations_select on public.registrations
  for select to authenticated
  using (public.is_confirmed(activity_id) or user_id = auth.uid());

drop policy if exists registrations_write on public.registrations;
create policy registrations_write on public.registrations
  for insert to authenticated
  with check (user_id = auth.uid() and public.access_open());

drop policy if exists registrations_update on public.registrations;
create policy registrations_update on public.registrations
  for update to authenticated
  using (user_id = auth.uid() and public.access_open())
  with check (user_id = auth.uid() and public.access_open());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.chat_open(activity_id)
    and public.is_confirmed(activity_id)
    and public.access_open()
    and not private.blocked_pair(user_id)
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.access_open()
    and public.chat_open(activity_id)
    and public.is_confirmed(activity_id)
    and not private.no_unblocked_peer(activity_id)
  );

drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks
  for insert to authenticated
  with check (
    blocker_id = auth.uid()
    and public.access_open()
    and exists (
      select 1 from public.registrations mine
      join public.registrations theirs
        on theirs.activity_id = mine.activity_id
      where mine.user_id = auth.uid()
        and mine.status = 'confirmed'
        and theirs.user_id = blocked_id
        and theirs.status = 'confirmed'
    )
  );

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and public.access_open()
    and private.report_allowed(activity_id, message_id)
  );

revoke all on table public.profiles from public, anon;
revoke all on table public.activities from public, anon, authenticated;
revoke all on table public.registrations from public, anon;
revoke all on table public.messages from public, anon;
revoke all on table public.blocks from public, anon;
revoke all on table public.reports from public, anon, authenticated;

grant select (id, display_name, created_at) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select (
  id, title, place_id, place_label, starts_at, capacity, status, created_at
) on table public.activities to anon, authenticated;
grant insert (
  id, creator_id, title, place_id, place_label, starts_at, meeting_point, capacity
) on table public.activities to authenticated;
grant update (title, place_label, starts_at, meeting_point, capacity, status)
  on table public.activities to authenticated;
grant select, insert, update on table public.registrations to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert on table public.blocks to authenticated;
grant insert (reporter_id, activity_id, message_id, reason) on table public.reports to authenticated;

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  status text not null default 'requested' check (status in ('requested', 'pending_auth', 'completed')),
  outcome text check (outcome is null or outcome in ('deleted', 'anonymized')),
  unique (user_id)
);

alter table public.deletion_requests enable row level security;

drop policy if exists deletion_insert on public.deletion_requests;
create policy deletion_insert on public.deletion_requests
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists deletion_select on public.deletion_requests;
create policy deletion_select on public.deletion_requests
  for select to authenticated using (user_id = auth.uid());

revoke all on table public.deletion_requests from public, anon, authenticated;
grant select (id, user_id, created_at, fulfilled_at, status, outcome) on table public.deletion_requests to authenticated;
grant insert (user_id) on table public.deletion_requests to authenticated;

create table if not exists private.deletion_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null,
  outcome text not null check (outcome in ('deleted', 'anonymized')),
  auth_action text not null check (auth_action in ('delete', 'soft_delete')),
  auth_status text not null default 'pending' check (auth_status in ('pending', 'failed', 'succeeded')),
  auth_attempts int not null default 0 check (auth_attempts >= 0),
  auth_note text,
  retained_reports int not null default 0,
  db_completed_at timestamptz not null default now(),
  auth_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  message_id uuid,
  activity_id uuid,
  author_id uuid,
  body text,
  retained_at timestamptz not null default now()
);

alter table private.deletion_audit enable row level security;
alter table private.report_evidence enable row level security;
revoke all on table private.deletion_audit from public, anon, authenticated;
revoke all on table private.report_evidence from public, anon, authenticated;

create or replace function private.drop_closed_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from 'open' then
    delete from private.report_evidence where report_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_drop_evidence on public.reports;
create trigger reports_drop_evidence
  after update of status on public.reports
  for each row
  execute function private.drop_closed_evidence();

create or replace function private.release_created_activities(target uuid, remove_solo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  act record;
  heir uuid;
begin
  for act in
    select a.id from public.activities a where a.creator_id = target
  loop
    heir := null;
    select r.user_id into heir
    from public.registrations r
    where r.activity_id = act.id
      and r.user_id <> target
    order by case when r.status = 'confirmed' then 0 else 1 end, r.created_at
    limit 1;
    if heir is not null then
      update public.activities
      set creator_id = heir, status = 'cancelled'
      where id = act.id;
    elsif remove_solo then
      delete from public.activities where id = act.id;
    else
      update public.activities set status = 'cancelled' where id = act.id;
    end if;
  end loop;
end;
$$;

create or replace function private.prepare_deletion(target_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  done timestamptz;
  existing_status text;
  open_n int;
  result_outcome text;
  result_action text;
begin
  select d.user_id, d.fulfilled_at into target, done
  from public.deletion_requests d
  where d.id = target_request;
  if target is null then
    raise exception 'deletion request not found';
  end if;
  if done is not null then
    raise exception 'deletion request already completed';
  end if;

  select a.auth_status, a.outcome into existing_status, result_outcome
  from private.deletion_audit a
  where a.request_id = target_request;
  if existing_status = 'succeeded' then
    raise exception 'deletion request already completed';
  end if;
  if existing_status in ('pending', 'failed') then
    return result_outcome;
  end if;

  select count(*)::int into open_n
  from public.reports r
  where r.status = 'open'
    and (
      r.reporter_id = target
      or exists (
        select 1 from public.messages m
        where m.id = r.message_id and m.user_id = target
      )
    );

  if open_n > 0 then
    result_outcome := 'anonymized';
    result_action := 'soft_delete';
    insert into private.report_evidence (report_id, message_id, activity_id, author_id, body)
    select r.id, m.id, m.activity_id, m.user_id, m.body
    from public.reports r
    join public.messages m on m.id = r.message_id
    where r.status = 'open'
      and (r.reporter_id = target or m.user_id = target);
    perform private.release_created_activities(target, false);
  else
    result_outcome := 'deleted';
    result_action := 'delete';
    perform private.release_created_activities(target, true);
    delete from public.reports where reporter_id = target and status <> 'open';
  end if;

  delete from public.messages where user_id = target;
  delete from public.registrations where user_id = target;
  delete from public.blocks where blocker_id = target or blocked_id = target;
  update public.profiles
  set display_name = '已删除', access_revoked = true
  where id = target;
  update public.deletion_requests
  set status = 'pending_auth', outcome = result_outcome
  where id = target_request;
  insert into private.deletion_audit (
    request_id, user_id, outcome, auth_action, auth_status, retained_reports
  ) values (
    target_request, target, result_outcome, result_action, 'pending', open_n
  );
  return result_outcome;
end;
$$;

create or replace function private.record_auth_failure(target_request uuid, note text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempts int;
begin
  if note is null or char_length(btrim(note)) = 0 then
    raise exception 'a short failure reason is required';
  end if;
  if note ~* 'service_role|sb_secret_|bearer ' then
    raise exception 'the failure note must not contain a credential';
  end if;
  update private.deletion_audit
  set auth_status = 'failed',
      auth_attempts = auth_attempts + 1,
      auth_note = left(btrim(note), 160)
  where request_id = target_request
    and auth_status in ('pending', 'failed')
  returning auth_attempts into attempts;
  if attempts is null then
    raise exception 'no pending auth step for this request';
  end if;
  return attempts;
end;
$$;

create or replace function private.complete_deletion(target_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  result_outcome text;
  result_action text;
  existing_status text;
begin
  select a.user_id, a.outcome, a.auth_action, a.auth_status
  into target, result_outcome, result_action, existing_status
  from private.deletion_audit a
  where a.request_id = target_request;
  if target is null then
    raise exception 'database step not finished';
  end if;
  if existing_status = 'succeeded' then
    raise exception 'deletion request already completed';
  end if;
  if result_action = 'delete' then
    if exists (select 1 from auth.users u where u.id = target) then
      raise exception 'auth login still exists';
    end if;
  elsif not exists (
    select 1 from auth.users u
    where u.id = target and u.deleted_at is not null
  ) then
    raise exception 'auth login is not soft-deleted';
  end if;

  update private.deletion_audit
  set auth_status = 'succeeded', auth_completed_at = now()
  where request_id = target_request;
  update public.deletion_requests
  set status = 'completed', fulfilled_at = now()
  where id = target_request;
  if result_outcome = 'deleted' then
    delete from public.profiles where id = target;
  end if;
  return result_outcome;
end;
$$;

drop function if exists private.fulfill_deletion(uuid);

revoke all on function public.confirmed_count(uuid) from public, anon;
revoke all on function public.is_confirmed(uuid) from public, anon;
revoke all on function public.chat_open(uuid) from public, anon;
revoke all on function public.participant_counts() from public;
revoke all on function public.participant_meeting(uuid) from public, anon;
revoke all on function public.caller_is_creator(uuid) from public, anon;
revoke all on function public.access_open() from public, anon;
revoke all on function public.messages_paused(uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_registration() from public, anon, authenticated;
revoke all on function private.blocked_pair(uuid) from public, anon;
drop function if exists private.blocked_in_activity(uuid);
revoke all on function private.no_unblocked_peer(uuid) from public, anon;
revoke all on function private.report_allowed(uuid, uuid) from public, anon;
grant execute on function private.report_allowed(uuid, uuid) to authenticated;
revoke all on function private.purge_old_reports() from public, anon, authenticated;
revoke all on function private.drop_closed_evidence() from public, anon, authenticated;
revoke all on function private.prepare_deletion(uuid) from public, anon, authenticated;
revoke all on function private.record_auth_failure(uuid, text) from public, anon, authenticated;
revoke all on function private.complete_deletion(uuid) from public, anon, authenticated;
revoke all on function private.release_created_activities(uuid, boolean) from public, anon, authenticated;

grant execute on function public.confirmed_count(uuid) to anon, authenticated;
grant execute on function public.is_confirmed(uuid) to authenticated;
grant execute on function public.chat_open(uuid) to authenticated;
grant execute on function public.participant_counts() to anon, authenticated;
grant execute on function public.participant_meeting(uuid) to authenticated;
grant execute on function public.caller_is_creator(uuid) to authenticated;
grant execute on function public.access_open() to authenticated;
grant execute on function public.messages_paused(uuid) to authenticated;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.blocked_pair(uuid) to authenticated;
grant execute on function private.no_unblocked_peer(uuid) to authenticated;

alter table public.messages replica identity full;

-- Realtime authorizes every INSERT with the messages SELECT policy for the
-- subscriber's JWT. Leaving, cancellation, and a block are rechecked on the
-- next event, so a connection that was valid can stop receiving message contents.
-- A block hides that pair in both directions. Other confirmed participants stay.
-- Anonymous clients have no select grant on messages.
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
