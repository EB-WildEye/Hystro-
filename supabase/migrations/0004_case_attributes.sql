-- The annotation columns of the source spreadsheet (age, pathology type,
-- lesion size, ...), kept per case for the admin export.
--
-- They live in their own table so reviewers cannot read them: a reviewer
-- rates from the admission note and ultrasound only. Admin-only via RLS.
-- Written by scripts/import_cases.py with the secret key.

create table public.case_attributes (
  case_id    bigint primary key references public.cases (id) on delete cascade,
  -- Ordered as in the source sheet: [{"name": "<header>", "value": "<text>" | null}, ...]
  attributes jsonb not null default '[]'::jsonb check (jsonb_typeof(attributes) = 'array')
);

alter table public.case_attributes enable row level security;

create policy case_attributes_admin_select on public.case_attributes
  for select to authenticated
  using ((select public.is_admin()));

grant select on public.case_attributes to authenticated;
grant select, insert, update, delete on public.case_attributes to service_role;
