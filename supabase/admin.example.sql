-- خطوة — admin setup — EXAMPLE.
-- Copy this file to supabase/admin.sql (ignored by Git), put your own admin email at the bottom, then run it.
-- Run AFTER supabase/schema.sql: Supabase → SQL Editor → New query → paste → Run. Safe to run again.
-- Everything an admin can see or do is checked here, in the database, so the admin pages are useless to
-- anyone whose account is not listed in public.admins.

-- ============ Who is an admin ============

create table if not exists public.admins (
  user_id  uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;   -- no policies: the list is only editable from the SQL Editor

create or replace function public.is_admin() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.admins where user_id = auth.uid());
end $$;

-- ============ Contact requests: admins read, update and delete ============

drop policy if exists "contact admin read" on public.contact_messages;
create policy "contact admin read" on public.contact_messages for select to authenticated using (public.is_admin());
drop policy if exists "contact admin update" on public.contact_messages;
create policy "contact admin update" on public.contact_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "contact admin delete" on public.contact_messages;
create policy "contact admin delete" on public.contact_messages for delete to authenticated using (public.is_admin());

-- ============ Quick ideas: admins see all (including hidden ones) and change them ============

drop policy if exists "ideas admin all" on public.habit_ideas;
create policy "ideas admin all" on public.habit_ideas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ Reports ============

-- Headline numbers for the home page.
create or replace function public.admin_overview() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return json_build_object(
    'users',        (select count(*) from auth.users),
    'users_week',   (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_week',  (select count(distinct user_id) from public.completions where day > current_date - 7),
    'active_today', (select count(distinct user_id) from public.completions where day = current_date),
    'habits',       (select count(*) from public.habits),
    'done_today',   (select count(*) from public.completions where day = current_date),
    'done_week',    (select count(*) from public.completions where day > current_date - 7),
    'groups',       (select count(*) from public.groups),
    'ideas',        (select count(*) from public.habit_ideas where active),
    'messages_new', (select count(*) from public.contact_messages where status = 'new')
  );
end $$;

-- Trends and breakdowns for the stats page (last 30 days).
create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return json_build_object(
    'days', (select json_agg(json_build_object(
                'day', d::date,
                'signups', (select count(*) from auth.users u where u.created_at::date = d::date),
                'active', (select count(distinct c.user_id) from public.completions c where c.day = d::date),
                'done', (select count(*) from public.completions c where c.day = d::date)) order by d)
             from generate_series(current_date - 29, current_date, interval '1 day') d),
    'top_habits', (select coalesce(json_agg(t), '[]') from (
                     select min(name) as name, count(distinct user_id) as users
                     from public.habits group by lower(trim(name)) order by users desc, name limit 10) t),
    'icons', (select coalesce(json_agg(t), '[]') from (
                select icon, count(*) as n from public.habits group by icon order by n desc) t),
    'streaks', (select json_build_object(
                  'zero', count(*) filter (where streak = 0),
                  'short', count(*) filter (where streak between 1 and 2),
                  'week', count(*) filter (where streak between 3 and 6),
                  'two_weeks', count(*) filter (where streak between 7 and 13),
                  'long', count(*) filter (where streak >= 14)) from public.profiles),
    'groups', (select json_build_object(
                 'count', count(*),
                 'avg_members', round(coalesce(avg(n), 0), 1),
                 'largest', coalesce(max(n), 0))
               from (select count(*) as n from public.group_members group by group_id) g),
    'hidden', (select count(*) from public.profiles where hide_from_board),
    'avg_habits', (select round(coalesce(avg(n), 0), 1) from (select count(*) as n from public.habits group by user_id) h)
  );
end $$;

-- Every account with its profile and activity (newest first).
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz,
               habits bigint, done_week bigint, week_points int, streak int, hidden boolean,
               group_name text, is_admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select u.id, u.email::text, p.name, u.created_at, u.last_sign_in_at,
           (select count(*) from public.habits h where h.user_id = u.id),
           (select count(*) from public.completions c where c.user_id = u.id and c.day > current_date - 7),
           coalesce(p.week_points, 0), coalesce(p.streak, 0), coalesce(p.hide_from_board, false), g.name,
           exists (select 1 from public.admins a where a.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.group_members m on m.user_id = u.id
    left join public.groups g on g.id = m.group_id
    order by u.created_at desc;
end $$;

-- ============ Member actions ============

create or replace function public.admin_set_hidden(p_user uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.profiles set hide_from_board = p_hidden where id = p_user;
end $$;

create or replace function public.admin_remove_from_group(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.group_members where user_id = p_user;   -- an emptied group is removed by its trigger
end $$;

-- Deletes an account and all of its data. Admin accounts can't be deleted from here.
create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'is_admin'; end if;
  delete from auth.users where id = p_user;
end $$;

drop function if exists public.admin_groups();
revoke execute on function public.admin_overview(), public.admin_stats(), public.admin_users(),
  public.admin_set_hidden(uuid, boolean), public.admin_remove_from_group(uuid), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_overview(), public.admin_stats(), public.admin_users(),
  public.admin_set_hidden(uuid, boolean), public.admin_remove_from_group(uuid), public.admin_delete_user(uuid),
  public.is_admin() to authenticated;

-- ============ Make your account an admin ============
-- The account must already exist (sign up on the site first). Change the email if you use a different one.
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('YOUR-ADMIN-EMAIL@example.com')
on conflict do nothing;

-- To check, run this on its own in a new query; it should list your email:
--   select u.email as admin from public.admins a join auth.users u on u.id = a.user_id;
