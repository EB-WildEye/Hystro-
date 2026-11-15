-- Table privileges for service_role, the role behind the secret key that the
-- local admin scripts (scripts/create_users.py, scripts/import_cases.py) use.
--
-- A project created with "Automatically expose new tables" turned off gives
-- the Data API roles no default privileges, so service_role must be granted
-- access explicitly. It bypasses Row Level Security by design and is never
-- used by the web app.
grant select, insert, update, delete on all tables in schema public to service_role;
