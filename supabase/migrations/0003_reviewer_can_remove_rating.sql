-- Reviewers can remove one of their own ratings. The case then counts as
-- unrated for them and returns to their queue.
--
-- The removal is kept in the audit trail: rating_events gets a row with the
-- old rating and new_rating = null.

create policy ratings_delete_own on public.ratings
  for delete to authenticated
  using (reviewer_id = (select auth.uid()) and (select public.is_reviewer()));

grant delete on public.ratings to authenticated;

create or replace function public.log_rating_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rating_events (case_id, reviewer_id, old_rating, new_rating)
    values (new.case_id, new.reviewer_id, null, new.rating);
  elsif tg_op = 'UPDATE' and new.rating is distinct from old.rating then
    insert into public.rating_events (case_id, reviewer_id, old_rating, new_rating)
    values (new.case_id, new.reviewer_id, old.rating, new.rating);
  elsif tg_op = 'DELETE' then
    insert into public.rating_events (case_id, reviewer_id, old_rating, new_rating)
    values (old.case_id, old.reviewer_id, old.rating, null);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger ratings_audit on public.ratings;
create trigger ratings_audit after insert or update or delete on public.ratings
for each row execute function public.log_rating_event();
