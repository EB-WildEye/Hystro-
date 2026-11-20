-- Testers: accounts that try out the reviewer interface.
--
-- A tester rates exactly like a reviewer (same cards, queue, "my ratings",
-- edit and remove), but has no reviewer slot. The study data is the ratings
-- of the reviewers in slots 1-3: analytics, the cases table, the report and
-- the Excel export read reviewers by slot, so a tester's ratings never enter
-- them. The admin sees testers' ratings on their own page.
--
-- "May rate" is now its own question (is_rater), separate from "is one of
-- the study's reviewers" (role = 'reviewer'), so is_reviewer() is replaced.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'reviewer', 'tester'));

-- Exactly the reviewers have a slot.
alter table public.profiles drop constraint reviewer_has_slot;
alter table public.profiles add constraint reviewer_has_slot
  check ((role = 'reviewer') = (reviewer_slot is not null));

create function public.is_rater() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('reviewer', 'tester')
  );
$$;

grant execute on function public.is_rater() to authenticated;

alter policy cases_select on public.cases
  using ((select public.is_rater()) or (select public.is_admin()));

alter policy datasets_select on public.datasets
  using ((select public.is_rater()) or (select public.is_admin()));

alter policy ratings_insert_own on public.ratings
  with check (reviewer_id = (select auth.uid()) and (select public.is_rater()));

alter policy ratings_update_own on public.ratings
  using (reviewer_id = (select auth.uid()) and (select public.is_rater()))
  with check (reviewer_id = (select auth.uid()) and (select public.is_rater()));

alter policy ratings_delete_own on public.ratings
  using (reviewer_id = (select auth.uid()) and (select public.is_rater()));

alter policy reviewer_state_insert_own on public.reviewer_state
  with check (reviewer_id = (select auth.uid()) and (select public.is_rater()));

drop function public.is_reviewer();
