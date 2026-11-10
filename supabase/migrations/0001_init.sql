-- Hysteroscopy rating app - initial schema
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- Security model:
--   * Every table has Row Level Security enabled.
--   * Reviewers can read cases and only THEIR OWN ratings. They can never
--     read another reviewer's rating - enforced here, not in the UI.
--   * Admins can read everything and cannot write ratings.
--   * Roles live in public.profiles, which users cannot modify. Profiles are
--     created only by scripts/create_users.py using the service-role key.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  role          text not null check (role in ('admin', 'reviewer')),
  reviewer_slot smallint unique check (reviewer_slot between 1 and 3),
  created_at    timestamptz not null default now(),
  constraint reviewer_has_slot check (
    (role = 'reviewer' and reviewer_slot is not null)
    or (role = 'admin' and reviewer_slot is null)
  )
);

create table public.cases (
  id              bigint generated always as identity primary key,
  case_number     text not null unique,
  admission_text  text not null,
  ultrasound_text text,
  sort_order      integer not null unique,
  created_at      timestamptz not null default now()
);

create table public.ratings (
  id          bigint generated always as identity primary key,
  case_id     bigint not null references public.cases (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating      text not null check (rating in ('resident', 'specialist')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (case_id, reviewer_id)
);

create index ratings_reviewer_idx on public.ratings (reviewer_id);

-- Where each reviewer stopped, so they resume from the same point.
-- Kept apart from profiles so that a writable row never sits next to the role.
create table public.reviewer_state (
  reviewer_id     uuid primary key references public.profiles (id) on delete cascade,
  last_sort_order integer not null default 0,
  updated_at      timestamptz not null default now()
);

-- Append-only audit trail of every rating change (research integrity).
create table public.rating_events (
  id          bigint generated always as identity primary key,
  case_id     bigint not null,
  reviewer_id uuid not null,
  old_rating  text,
  new_rating  text,
  changed_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies can read profiles without
-- recursion; search_path pinned to avoid hijacking)
-- ---------------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.is_reviewer() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'reviewer'
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger ratings_touch before update on public.ratings
for each row execute function public.touch_updated_at();

create function public.log_rating_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rating_events (case_id, reviewer_id, old_rating, new_rating)
    values (new.case_id, new.reviewer_id, null, new.rating);
  elsif tg_op = 'UPDATE' and new.rating is distinct from old.rating then
    insert into public.rating_events (case_id, reviewer_id, old_rating, new_rating)
    values (new.case_id, new.reviewer_id, old.rating, new.rating);
  end if;
  return new;
end;
$$;

create trigger ratings_audit after insert or update on public.ratings
for each row execute function public.log_rating_event();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.cases          enable row level security;
alter table public.ratings        enable row level security;
alter table public.reviewer_state enable row level security;
alter table public.rating_events  enable row level security;

-- profiles: read own row; admin reads all. No insert/update/delete policies:
-- only the service role (scripts) can change roles.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- cases: readable by reviewers and admins only. Written by the import script.
create policy cases_select on public.cases
  for select to authenticated
  using ((select public.is_reviewer()) or (select public.is_admin()));

-- ratings: a reviewer sees and writes only their own rows; admin reads all.
create policy ratings_select on public.ratings
  for select to authenticated
  using (reviewer_id = (select auth.uid()) or (select public.is_admin()));

create policy ratings_insert_own on public.ratings
  for insert to authenticated
  with check (reviewer_id = (select auth.uid()) and (select public.is_reviewer()));

create policy ratings_update_own on public.ratings
  for update to authenticated
  using (reviewer_id = (select auth.uid()) and (select public.is_reviewer()))
  with check (reviewer_id = (select auth.uid()) and (select public.is_reviewer()));

-- reviewer_state: own row only.
create policy reviewer_state_select_own on public.reviewer_state
  for select to authenticated
  using (reviewer_id = (select auth.uid()));

create policy reviewer_state_insert_own on public.reviewer_state
  for insert to authenticated
  with check (reviewer_id = (select auth.uid()) and (select public.is_reviewer()));

create policy reviewer_state_update_own on public.reviewer_state
  for update to authenticated
  using (reviewer_id = (select auth.uid()))
  with check (reviewer_id = (select auth.uid()));

-- rating_events: admin read only. Rows are written by the trigger.
create policy rating_events_admin_select on public.rating_events
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Grants: nothing for anonymous visitors; authenticated gets only what the
-- policies above can ever allow.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, public;

grant select on public.profiles, public.cases, public.rating_events to authenticated;
grant select, insert, update on public.ratings, public.reviewer_state to authenticated;
grant execute on function public.is_admin(), public.is_reviewer() to authenticated;

-- ---------------------------------------------------------------------------
-- Queue: next case the calling reviewer has not rated, starting after a
-- given position and wrapping around. Runs as the caller, so RLS applies.
-- ---------------------------------------------------------------------------

create function public.next_unrated_case(after_order integer)
returns bigint
language sql stable security invoker set search_path = ''
as $$
  select c.id
  from public.cases c
  where not exists (
    select 1 from public.ratings r
    where r.case_id = c.id and r.reviewer_id = (select auth.uid())
  )
  order by (c.sort_order <= after_order), c.sort_order
  limit 1;
$$;

grant execute on function public.next_unrated_case(integer) to authenticated;
