-- Two ratings per case, on a new scale.
--
-- * Each reviewer rates every case twice: entering the uterine cavity
--   (stage 'entry', diagnostic hysteroscopy) and the operative procedure
--   (stage 'operative', operative hysteroscopy).
-- * The answer is a junior or a senior specialist. The operative stage can
--   also be 'not_applicable' when no operative step is planned.
-- * Ratings on the previous scale (resident / specialist, one question per
--   case) answer a different question and cannot be converted. They were
--   test ratings and are deleted; the audit trail records each deletion.

-- Old ratings go first, while the audit trigger still matches their shape.
delete from public.ratings;

-- ---------------------------------------------------------------------------
-- Ratings: one per case, reviewer and stage
-- ---------------------------------------------------------------------------

alter table public.ratings add column stage text not null check (stage in ('entry', 'operative'));

alter table public.ratings drop constraint ratings_rating_check;
alter table public.ratings add constraint ratings_rating_check check (
  rating in ('junior', 'senior')
  or (rating = 'not_applicable' and stage = 'operative')
);

alter table public.ratings drop constraint ratings_case_id_reviewer_id_key;
alter table public.ratings add constraint ratings_case_reviewer_stage_key unique (case_id, reviewer_id, stage);

-- The audit trail records the stage too. Earlier events have none.
alter table public.rating_events add column stage text;

create or replace function public.log_rating_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rating_events (case_id, reviewer_id, stage, old_rating, new_rating)
    values (new.case_id, new.reviewer_id, new.stage, null, new.rating);
  elsif tg_op = 'UPDATE' and new.rating is distinct from old.rating then
    insert into public.rating_events (case_id, reviewer_id, stage, old_rating, new_rating)
    values (new.case_id, new.reviewer_id, new.stage, old.rating, new.rating);
  elsif tg_op = 'DELETE' then
    insert into public.rating_events (case_id, reviewer_id, stage, old_rating, new_rating)
    values (old.case_id, old.reviewer_id, old.stage, old.rating, null);
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue: items are (case, stage), entry before operative within a case
-- ---------------------------------------------------------------------------

-- A position is the case's sort order plus the stage; 'operative' means the
-- whole case is behind the reviewer. Existing positions keep pointing past
-- the case they were on.
alter table public.reviewer_state add column last_stage text not null default 'operative'
  check (last_stage in ('entry', 'operative'));

drop function public.next_unrated_case(bigint, integer);

create function public.stage_rank(p_stage text) returns integer
language sql immutable set search_path = ''
as $$ select case p_stage when 'entry' then 1 when 'operative' then 2 end $$;

-- Next (case, stage) in the dataset the caller has not rated, after a
-- position, wrapping around to the start.
create function public.next_unrated_item(p_dataset_id bigint, after_order integer, after_stage text)
returns table (case_id bigint, stage text)
language sql stable security invoker set search_path = ''
as $$
  select c.id, s.stage
  from public.cases c
  cross join (values ('entry'), ('operative')) as s (stage)
  where c.dataset_id = p_dataset_id
    and not exists (
      select 1 from public.ratings r
      where r.case_id = c.id and r.stage = s.stage and r.reviewer_id = (select auth.uid())
    )
  order by
    ((c.sort_order, public.stage_rank(s.stage)) <= (after_order, public.stage_rank(after_stage))),
    c.sort_order,
    public.stage_rank(s.stage)
  limit 1;
$$;

grant execute on function public.stage_rank(text) to authenticated;
grant execute on function public.next_unrated_item(bigint, integer, text) to authenticated;
