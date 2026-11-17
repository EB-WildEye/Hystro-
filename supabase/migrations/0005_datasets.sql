-- Datasets: each uploaded spreadsheet of cases is its own dataset.
--
-- * Every dataset is open to all reviewers; each reviewer picks which one to
--   work on, by the name the admin gives it. The admin can rename a dataset,
--   and deleting it removes it for everyone, with its cases and ratings.
-- * Cases, queue position and statistics are per dataset.
-- * The admin uploads datasets in the app through import_dataset(), which
--   checks the admin role itself, so the app never needs the secret key.
--
-- Existing cases are moved into a first dataset named TABLE_1.

-- ---------------------------------------------------------------------------
-- Datasets
-- ---------------------------------------------------------------------------

create table public.datasets (
  id         bigint generated always as identity primary key,
  name       text not null unique check (length(btrim(name)) > 0 and name = btrim(name)),
  created_at timestamptz not null default now()
);

alter table public.datasets enable row level security;

create policy datasets_select on public.datasets
  for select to authenticated
  using ((select public.is_reviewer()) or (select public.is_admin()));

-- The admin can rename a dataset (and change nothing else, see the grant).
create policy datasets_admin_update on public.datasets
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Deleting a dataset removes its cases, their ratings and annotation columns
-- (on delete cascade). The rating audit trail in rating_events is kept.
create policy datasets_admin_delete on public.datasets
  for delete to authenticated
  using ((select public.is_admin()));

grant select, delete on public.datasets to authenticated;
grant update (name) on public.datasets to authenticated;
grant select, insert, update, delete on public.datasets to service_role;

-- ---------------------------------------------------------------------------
-- Cases belong to a dataset
-- ---------------------------------------------------------------------------

insert into public.datasets (name)
select 'TABLE_1' where exists (select 1 from public.cases);

alter table public.cases add column dataset_id bigint references public.datasets (id) on delete cascade;
update public.cases set dataset_id = (select min(id) from public.datasets);
alter table public.cases alter column dataset_id set not null;

-- Serial numbers and order are unique within a dataset, not globally.
alter table public.cases drop constraint cases_case_number_key;
alter table public.cases drop constraint cases_sort_order_key;
alter table public.cases add constraint cases_dataset_case_number_key unique (dataset_id, case_number);
alter table public.cases add constraint cases_dataset_sort_order_key unique (dataset_id, sort_order);

-- ---------------------------------------------------------------------------
-- Queue position per reviewer and dataset
-- ---------------------------------------------------------------------------

alter table public.reviewer_state add column dataset_id bigint references public.datasets (id) on delete cascade;
update public.reviewer_state set dataset_id = (select min(id) from public.datasets);
delete from public.reviewer_state where dataset_id is null;
alter table public.reviewer_state alter column dataset_id set not null;
alter table public.reviewer_state drop constraint reviewer_state_pkey;
alter table public.reviewer_state add primary key (reviewer_id, dataset_id);

drop function public.next_unrated_case(integer);

-- Next case in the dataset the caller has not rated, after a position, wrapping.
create function public.next_unrated_case(p_dataset_id bigint, after_order integer)
returns bigint
language sql stable security invoker set search_path = ''
as $$
  select c.id
  from public.cases c
  where c.dataset_id = p_dataset_id
    and not exists (
      select 1 from public.ratings r
      where r.case_id = c.id and r.reviewer_id = (select auth.uid())
    )
  order by (c.sort_order <= after_order), c.sort_order
  limit 1;
$$;

grant execute on function public.next_unrated_case(bigint, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Upload: one call creates the dataset with all its cases, or nothing.
-- ---------------------------------------------------------------------------

-- p_cases: [{"case_number", "admission_text", "ultrasound_text", "attributes": [{"name", "value"}]}]
create function public.import_dataset(p_name text, p_cases jsonb) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_dataset_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can upload cases' using errcode = '42501';
  end if;
  if jsonb_typeof(p_cases) <> 'array' or jsonb_array_length(p_cases) = 0 then
    raise exception 'The file has no cases' using errcode = '22023';
  end if;

  insert into public.datasets (name) values (btrim(p_name)) returning id into v_dataset_id;

  insert into public.cases (dataset_id, case_number, admission_text, ultrasound_text, sort_order)
  select v_dataset_id, x.value ->> 'case_number', x.value ->> 'admission_text', x.value ->> 'ultrasound_text', x.ordinality
  from jsonb_array_elements(p_cases) with ordinality as x (value, ordinality);

  insert into public.case_attributes (case_id, attributes)
  select c.id, coalesce(x.value -> 'attributes', '[]'::jsonb)
  from jsonb_array_elements(p_cases) with ordinality as x (value, ordinality)
  join public.cases c on c.dataset_id = v_dataset_id and c.sort_order = x.ordinality;

  return v_dataset_id;
end;
$$;

revoke all on function public.import_dataset(text, jsonb) from public, anon;
grant execute on function public.import_dataset(text, jsonb) to authenticated;
