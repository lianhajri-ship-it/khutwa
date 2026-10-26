-- خطوة — Supabase database.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates what is missing and replaces functions and policies.

-- ============ Tables ============

create table if not exists public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  name            text not null check (char_length(name) between 1 and 30),
  hide_from_board boolean not null default false,
  week_points     int  not null default 0,      -- written by the owner's browser after each change
  week_start      date,                         -- the Sunday week_points belongs to
  streak          int  not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  target     int  not null default 1 check (target between 1 and 20),
  icon       text not null default 'star',
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id);

create table if not exists public.completions (
  habit_id uuid not null references public.habits on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  day      date not null,
  count    int  not null check (count between 1 and 20),
  primary key (habit_id, day)
);
create index if not exists completions_user_day_idx on public.completions (user_id, day);

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 30),
  code       text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (user_id)                               -- one group per person for now
);

create table if not exists public.challenges (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups on delete cascade,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  habit_name text not null check (char_length(habit_name) between 1 and 40),
  days       int  not null check (days in (3, 7, 14, 30)),
  start_day  date not null default current_date,
  created_at timestamptz not null default now()
);

-- Messages sent from the contact form. Anyone can send; none can be read back through the public API.
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users on delete set null,
  name       text not null check (char_length(name) between 1 and 60),
  email      text not null check (char_length(email) between 3 and 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic      text not null default 'other' check (topic in ('suggestion', 'problem', 'account', 'other')),
  message    text not null check (char_length(message) between 5 and 2000),
  status     text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);

-- Quick habit ideas shown on the habits page.
create table if not exists public.habit_ideas (
  id         uuid primary key default gen_random_uuid(),
  name_ar    text not null check (char_length(name_ar) between 1 and 40),
  name_en    text not null check (char_length(name_en) between 1 and 40),
  target     int  not null default 1 check (target between 1 and 20),
  icon       text not null default 'star' check (icon in ('water', 'run', 'book', 'moon', 'leaf', 'phone', 'star')),
  sort       int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Starting ideas, added only while the table is empty.
insert into public.habit_ideas (name_ar, name_en, target, icon, sort)
select * from (values
  ('شرب ٨ أكواب ماء', 'Drink 8 glasses of water', 8, 'water', 1),
  ('مشي ٣٠ دقيقة', 'Walk 30 minutes', 1, 'run', 2),
  ('قراءة ٢٠ صفحة', 'Read 20 pages', 1, 'book', 3),
  ('النوم قبل ١١', 'Sleep before 11', 1, 'moon', 4),
  ('تأمل ١٠ دقائق', 'Meditate 10 minutes', 1, 'leaf', 5),
  ('بدون جوال ساعة قبل النوم', 'No phone an hour before bed', 1, 'phone', 6)
) as v (name_ar, name_en, target, icon, sort)
where not exists (select 1 from public.habit_ideas);

-- ============ Helpers ============

-- The signed-in person's group. Security definer so policies can use it without recursing into group_members.
create or replace function public.my_group_id() returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.group_members where user_id = auth.uid()
$$;

-- Every new account gets a profile; the name comes from sign-up, or the email before the @.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 30))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Row level security: who can see and change what ============

alter table public.profiles      enable row level security;
alter table public.habits        enable row level security;
alter table public.completions   enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.challenges    enable row level security;

-- Profiles: you see yourself; group mates see each other unless someone chose to hide.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (
  id = auth.uid()
  or (not hide_from_board and id in (select user_id from public.group_members where group_id = public.my_group_id()))
);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Habits and completions: private to their owner. Nobody else can read them.
drop policy if exists "habits own" on public.habits;
create policy "habits own" on public.habits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "completions own" on public.completions;
create policy "completions own" on public.completions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid()));

-- Groups: members see their own group. Creating and joining go through the functions below.
drop policy if exists "groups read own" on public.groups;
create policy "groups read own" on public.groups for select to authenticated using (id = public.my_group_id());

drop policy if exists "members read own group" on public.group_members;
create policy "members read own group" on public.group_members for select to authenticated using (group_id = public.my_group_id());
drop policy if exists "members leave" on public.group_members;
create policy "members leave" on public.group_members for delete to authenticated using (user_id = auth.uid());

-- Challenges: visible to the group; any member can start one; only its creator can delete it.
drop policy if exists "challenges read" on public.challenges;
create policy "challenges read" on public.challenges for select to authenticated using (group_id = public.my_group_id());
drop policy if exists "challenges create" on public.challenges;
create policy "challenges create" on public.challenges for insert to authenticated
  with check (group_id = public.my_group_id() and created_by = auth.uid());
drop policy if exists "challenges delete own" on public.challenges;
create policy "challenges delete own" on public.challenges for delete to authenticated using (created_by = auth.uid());

-- Habit ideas: everyone can read the active ones; there is no public write access.
alter table public.habit_ideas enable row level security;
drop policy if exists "ideas read active" on public.habit_ideas;
create policy "ideas read active" on public.habit_ideas for select to anon, authenticated using (active);

-- Contact form: anyone (signed in or not) can send a message; nobody can read them back through the API.
alter table public.contact_messages enable row level security;
drop policy if exists "contact send" on public.contact_messages;
create policy "contact send" on public.contact_messages for insert to anon, authenticated
  with check (status = 'new' and (user_id is null or user_id = auth.uid()));

-- At most 3 messages per email address per hour, to slow down spam.
create or replace function public.contact_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_messages
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'too_many';
  end if;
  return new;
end $$;

drop trigger if exists contact_rate_limit on public.contact_messages;
create trigger contact_rate_limit before insert on public.contact_messages
  for each row execute function public.contact_rate_limit();

-- ============ Actions ============

-- Create a group with a fresh KH-XXXX-XXXX code and join it (leaving any previous group).
-- 8 characters from a 31-letter alphabet (~850 billion codes) so codes can't be guessed by trying them,
-- drawn from gen_random_uuid(), which is cryptographically random. Older 4-character codes keep working.
create or replace function public.create_group(p_name text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  c text;
  b bytea;
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 30 then raise exception 'bad_name'; end if;
  loop
    b := uuid_send(gen_random_uuid());
    c := 'KH-';
    for i in 0..7 loop
      if i = 4 then c := c || '-'; end if;
      c := c || substr(chars, 1 + get_byte(b, i) % length(chars), 1);
    end loop;
    exit when not exists (select 1 from public.groups where code = c);
  end loop;
  delete from public.group_members where user_id = auth.uid();
  insert into public.groups (name, code, created_by) values (trim(p_name), c, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end $$;

-- Join a group by its invite code (leaving any previous group).
create or replace function public.join_group(p_code text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into g from public.groups where code = upper(trim(p_code));
  if not found then raise exception 'bad_code'; end if;
  delete from public.group_members where user_id = auth.uid();
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end $$;

-- Delete the signed-in account and, through the cascades above, all of its data.
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- When the last member leaves (or deletes their account), the empty group and its challenges go too.
create or replace function public.drop_empty_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.groups g where g.id = old.group_id
    and not exists (select 1 from public.group_members m where m.group_id = old.group_id);
  return null;
end $$;

drop trigger if exists on_member_left on public.group_members;
create trigger on_member_left after delete on public.group_members
  for each row execute function public.drop_empty_group();

-- One-time tidy-up of groups that were already empty before this trigger existed.
delete from public.groups g where not exists (select 1 from public.group_members m where m.group_id = g.id);

revoke execute on function public.create_group(text), public.join_group(text), public.delete_me() from public, anon;
grant  execute on function public.create_group(text), public.join_group(text), public.delete_me() to authenticated;
