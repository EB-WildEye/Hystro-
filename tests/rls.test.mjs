// Row Level Security tests: runs the real migration on an in-memory Postgres
// (PGlite) with minimal Supabase auth stand-ins.  npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p);
// Minimal Supabase stand-ins: auth schema, auth.uid() from a GUC, roles.
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
`);
const migrations = readdirSync(new URL("../supabase/migrations/", import.meta.url)).sort();
const run = async (file) => db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
const A="00000000-0000-0000-0000-00000000000a", R1="00000000-0000-0000-0000-000000000001", R2="00000000-0000-0000-0000-000000000002", R3="00000000-0000-0000-0000-000000000003";
// Seed data the way the live database had it before datasets existed, then
// run the remaining migrations on top: this tests the upgrade path itself.
const beforeDatasets = migrations.filter((f) => f < "0005");
for (const file of beforeDatasets) await run(file);
await db.exec(`
insert into auth.users values ('${A}','a'),('${R1}','r1'),('${R2}','r2'),('${R3}','r3');
insert into public.profiles values ('${A}','Admin','admin',null),('${R1}','Dr1','reviewer',1),('${R2}','Dr2','reviewer',2),('${R3}','Dr3','reviewer',3);
insert into public.cases (case_number, admission_text, sort_order) values ('101','t',1),('102','t',2),('103','t',3);
insert into public.reviewer_state (reviewer_id, last_sort_order) values ('${R1}', 1);
`);
for (const file of migrations.filter((f) => f >= "0005" && f < "0006")) await run(file);
// Old-scale test ratings, as the live database had them before 0006.
await db.exec(`insert into public.ratings (case_id, reviewer_id, rating) values (1,'${R1}','resident'),(2,'${R2}','specialist');`);
for (const file of migrations.filter((f) => f >= "0006")) await run(file);
let pass=0, fail=0;
const check=(name, ok)=>{ console.log((ok?"PASS ":"FAIL ")+name); if (ok) pass++; else fail++; };
async function as(uid, fn){ await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`); try { return await fn(); } finally { await db.exec(`reset role;`);} }
async function err(fn){ try{ await fn(); return null;}catch(e){ return e.message; } }

// two-stage upgrade
check("Old-scale ratings deleted", (await q(`select count(*)::int as n from ratings`)).rows[0].n === 0);
check("Audit trail records their deletion", (await q(`select string_agg(coalesce(new_rating,'deleted'), ',' order by id) as t from rating_events`)).rows[0].t === "resident,specialist,deleted,deleted");
check("Existing queue position points past its case", (await q(`select last_stage from reviewer_state where reviewer_id='${R1}'`)).rows[0].last_stage === "operative");

await as(R1, ()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (1,'${R1}','entry','junior'),(1,'${R1}','operative','not_applicable'),(2,'${R1}','entry','senior'),(2,'${R1}','operative','senior')`));
await as(R2, ()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (1,'${R2}','entry','senior')`));

check("R2 sees only own ratings", (await as(R2, ()=>q(`select * from ratings`))).rows.length === 1);
check("R2 cannot read R1 ratings by filter", (await as(R2, ()=>q(`select * from ratings where reviewer_id='${R1}'`))).rows.length === 0);
check("R2 cannot insert rating as R1", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (3,'${R1}','entry','junior')`)))));
const upd = await as(R2, ()=>q(`update ratings set rating='junior' where reviewer_id='${R1}'`));
check("R2 cannot update R1 rating", upd.affectedRows === 0);
check("R2 cannot remove R1 rating", (await as(R2, ()=>q(`delete from ratings where reviewer_id='${R1}'`))).affectedRows === 0);
check("R2 cannot read audit log", (await as(R2, ()=>q(`select * from rating_events`))).rows.length === 0);
check("R2 cannot read others' profiles", (await as(R2, ()=>q(`select * from profiles`))).rows.length === 1);
check("R2 cannot promote self to admin", !!(await as(R2, ()=>err(()=>q(`update profiles set role='admin' where id='${R2}'`)))));
check("R2 cannot write cases", !!(await as(R2, ()=>err(()=>q(`insert into cases (dataset_id, case_number, admission_text, sort_order) values (1, 'x','y',9)`)))));
check("Reviewer can read cases", (await as(R2, ()=>q(`select * from cases`))).rows.length === 3);
check("Invalid rating value rejected", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (2,'${R2}','entry','maybe')`)))));
check("Old scale rejected", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (2,'${R2}','entry','resident')`)))));
check("Rating needs a stage", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, rating) values (2,'${R2}','junior')`)))));
check("Unknown stage rejected", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (2,'${R2}','other','junior')`)))));
check("'Not applicable' only for the operative stage", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (2,'${R2}','entry','not_applicable')`)))));
check("One rating per case, reviewer and stage", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (1,'${R2}','entry','junior')`)))));
check("Admin sees all ratings", (await as(A, ()=>q(`select * from ratings`))).rows.length === 5);
check("Admin cannot rate", !!(await as(A, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (3,'${A}','entry','junior')`)))));
check("Admin sees all profiles", (await as(A, ()=>q(`select * from profiles`))).rows.length === 4);
// queue
const next = async (uid, ds, order, stage) => { const r = (await as(uid, ()=>q(`select case_id, stage from next_unrated_item($1, $2, $3)`, [ds, order, stage]))).rows[0]; return r ? `${r.case_id}:${r.stage}` : "none"; };
check("Queue R1 from the start -> case 3 entry", (await next(R1, 1, 0, "operative")) === "3:entry");
check("Queue R2: after case 1 entry comes case 1 operative", (await next(R2, 1, 1, "entry")) === "1:operative");
check("Queue R2: after case 1 operative comes case 2 entry", (await next(R2, 1, 1, "operative")) === "2:entry");
check("Queue R2 wraps to the first unrated item", (await next(R2, 1, 3, "operative")) === "1:operative");
// edit + audit
await as(R1, ()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values (1,'${R1}','entry','senior') on conflict (case_id, reviewer_id, stage) do update set rating = excluded.rating`));
check("Upsert changes own rating for that stage only", (await as(R1, ()=>q(`select stage, rating from ratings where case_id=1 order by stage`))).rows.map(r=>r.stage+"="+r.rating).join() === "entry=senior,operative=not_applicable");
check("Audit logged the change with its stage", (await as(A, ()=>q(`select stage, new_rating from rating_events where case_id=1 and reviewer_id='${R1}' and stage='entry' order by id`))).rows.map(r=>r.new_rating).join(",") === "junior,senior");
// removing a rating
check("Admin cannot remove ratings", (await as(A, ()=>q(`delete from ratings`))).affectedRows === 0);
check("R2 removes only own rating", (await as(R2, ()=>q(`delete from ratings`))).affectedRows === 1);
check("Other ratings survive", (await as(A, ()=>q(`select * from ratings`))).rows.length === 4);
check("Removed item returns to R2 queue", (await next(R2, 1, 0, "operative")) === "1:entry");
const removal = (await as(A, ()=>q(`select stage, old_rating, new_rating from rating_events where reviewer_id='${R2}' order by id desc limit 1`))).rows[0];
check("Audit logged the removal", removal.stage === "entry" && removal.old_rating === "senior" && removal.new_rating === null);
// reviewer_state
await as(R1, ()=>q(`insert into reviewer_state (reviewer_id, dataset_id, last_sort_order, last_stage) values ('${R1}', 1, 2, 'entry') on conflict (reviewer_id, dataset_id) do update set last_sort_order = excluded.last_sort_order, last_stage = excluded.last_stage`));
check("Reviewer saves own position with its stage", (await as(R1, ()=>q(`select last_stage from reviewer_state`))).rows[0].last_stage === "entry");
check("R2 cannot see R1 position", (await as(R2, ()=>q(`select * from reviewer_state`))).rows.length === 0);
// case_attributes: annotation columns, admin-only
await db.exec(`insert into case_attributes values (1, '[{"name":"age_years","value":"בת 42"}]')`);
check("Reviewer cannot read case attributes", (await as(R2, ()=>q(`select * from case_attributes`))).rows.length === 0);
check("Reviewer cannot write case attributes", !!(await as(R2, ()=>err(()=>q(`insert into case_attributes values (2, '[]')`)))));
check("Admin reads case attributes", (await as(A, ()=>q(`select * from case_attributes`))).rows.length === 1);
check("Attributes must be a list", !!(await err(()=>q(`insert into case_attributes values (3, '{}')`))));
// service_role: what the local admin scripts do with the secret key
await db.exec(`set role service_role;`);
check("Service role can upsert profiles", !(await err(()=>q(`insert into profiles values ('${R3}','Dr3b','reviewer',3) on conflict (id) do update set display_name = excluded.display_name`))));
check("Service role can import cases", !(await err(()=>q(`insert into cases (dataset_id, case_number, admission_text, sort_order) values (1, '104','t',4)`))));
check("Service role can read cases", (await q(`select * from cases`)).rows.length === 4);
check("Service role can write case attributes", !(await err(()=>q(`insert into case_attributes values (2, '[]') on conflict (case_id) do update set attributes = excluded.attributes`))));
await db.exec(`reset role;`);
// datasets: upgrade path, upload, active / inactive
check("Existing cases moved into TABLE_1", (await q(`select d.name, count(*)::int as n from cases c join datasets d on d.id = c.dataset_id group by d.name`)).rows.map(r=>r.name+":"+r.n).join() === "TABLE_1:4");
check("Existing queue position kept", (await q(`select dataset_id from reviewer_state where reviewer_id='${R1}'`)).rows[0].dataset_id == 1);
const upload = JSON.stringify([
  { case_number: "1", admission_text: "בת 30", ultrasound_text: null, attributes: [{ name: "age_years", value: "בת 30" }] },
  { case_number: "2", admission_text: "בת 31", ultrasound_text: "פוליפ", attributes: [] },
]);
check("Reviewer cannot upload", !!(await as(R2, ()=>err(()=>q(`select import_dataset('x', $1::jsonb)`, [upload])))));
const ds2 = (await as(A, ()=>q(`select import_dataset(' File 2 ', $1::jsonb) as id`, [upload]))).rows[0].id;
check("Admin upload creates the dataset", (await q(`select name from datasets where id=$1`, [ds2])).rows[0].name === "File 2");
check("Upload stores cases in sheet order", (await q(`select case_number from cases where dataset_id=$1 order by sort_order`, [ds2])).rows.map(r=>r.case_number).join() === "1,2");
check("Upload stores annotation columns", (await as(A, ()=>q(`select a.attributes from case_attributes a join cases c on c.id=a.case_id where c.dataset_id=$1 and c.case_number='1'`, [ds2]))).rows[0].attributes[0].value === "בת 30");
check("Same serial allowed in another dataset", !(await as(A, ()=>err(()=>q(`select import_dataset('File 5', $1::jsonb)`, [upload])))));
check("Duplicate dataset name rejected", !!(await as(A, ()=>err(()=>q(`select import_dataset('File 2', $1::jsonb)`, [upload])))));
check("Duplicate serial in one file rejected, nothing written", !!(await as(A, ()=>err(()=>q(`select import_dataset('File 3', $1::jsonb)`, [JSON.stringify([{case_number:"9",admission_text:"a"},{case_number:"9",admission_text:"b"}])])))) && (await q(`select count(*)::int as n from datasets where name='File 3'`)).rows[0].n === 0);
check("Empty upload rejected", !!(await as(A, ()=>err(()=>q(`select import_dataset('File 4', '[]'::jsonb)`)))));
const firstOf2 = (await q(`select id from cases where dataset_id=$1 order by sort_order limit 1`, [ds2])).rows[0].id;
check("Queue is per dataset", (await next(R2, ds2, 0, "operative")) === `${firstOf2}:entry`);
await as(R2, ()=>q(`insert into ratings (case_id, reviewer_id, stage, rating) values ($1,'${R2}','entry','junior')`, [firstOf2]));
check("Reviewer sees every dataset", (await as(R2, ()=>q(`select * from datasets`))).rows.length === 3);
// rename
check("Reviewer cannot rename a dataset", (await as(R2, ()=>q(`update datasets set name='x' where id=$1`, [ds2]))).affectedRows === 0);
check("Admin renames a dataset", (await as(A, ()=>q(`update datasets set name='שם חדש' where id=$1`, [ds2]))).affectedRows === 1);
check("Reviewer sees the new name", (await as(R2, ()=>q(`select name from datasets where id=$1`, [ds2]))).rows[0].name === "שם חדש");
check("Rename to an existing name rejected", !!(await as(A, ()=>err(()=>q(`update datasets set name='TABLE_1' where id=$1`, [ds2])))));
check("Blank or padded names rejected", !!(await as(A, ()=>err(()=>q(`update datasets set name=' x ' where id=$1`, [ds2])))));
check("Admin can change only the name", !!(await as(A, ()=>err(()=>q(`update datasets set created_at=now() where id=$1`, [ds2])))));
// delete
check("Reviewer cannot delete a dataset", (await as(R2, ()=>q(`delete from datasets where id=$1`, [ds2]))).affectedRows === 0);
await as(R2, ()=>q(`insert into reviewer_state (reviewer_id, dataset_id, last_sort_order) values ('${R2}', $1, 1)`, [ds2]));
check("Admin deletes a dataset", (await as(A, ()=>q(`delete from datasets where id=$1`, [ds2]))).affectedRows === 1);
check("Its cases, ratings, attributes and queue positions are gone",
  (await q(`select count(*)::int as n from cases where dataset_id=$1`, [ds2])).rows[0].n === 0 &&
  (await q(`select count(*)::int as n from ratings where case_id=$1`, [firstOf2])).rows[0].n === 0 &&
  (await q(`select count(*)::int as n from case_attributes where case_id=$1`, [firstOf2])).rows[0].n === 0 &&
  (await q(`select count(*)::int as n from reviewer_state where dataset_id=$1`, [ds2])).rows[0].n === 0);
check("Reviewer no longer sees the deleted dataset", !(await as(R2, ()=>q(`select * from datasets`))).rows.some(r=>r.id == ds2));
check("Audit trail keeps the rating and records its deletion", (await q(`select new_rating from rating_events where case_id=$1 order by id`, [firstOf2])).rows.map(r=>r.new_rating ?? "deleted").join() === "junior,deleted");
check("Other datasets untouched", (await q(`select count(*)::int as n from cases where dataset_id=1`)).rows[0].n === 4);
// anon
await db.exec(`set role anon;`);
check("Anon cannot read cases", !!(await err(()=>q(`select * from cases`))));
check("Anon cannot read ratings", !!(await err(()=>q(`select * from ratings`))));
check("Anon cannot read datasets", !!(await err(()=>q(`select * from datasets`))));
check("Anon cannot upload", !!(await err(()=>q(`select import_dataset('x', '[{"case_number":"1","admission_text":"a"}]'::jsonb)`))));
await db.exec(`reset role;`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
