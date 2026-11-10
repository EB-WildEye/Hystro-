// Row Level Security tests: runs the real migration on an in-memory Postgres
// (PGlite) with minimal Supabase auth stand-ins.  npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p);
// Minimal Supabase stand-ins: auth schema, auth.uid() from a GUC, roles.
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
`);
await db.exec(readFileSync(new URL("../supabase/migrations/0001_init.sql", import.meta.url), "utf8"));
const A="00000000-0000-0000-0000-00000000000a", R1="00000000-0000-0000-0000-000000000001", R2="00000000-0000-0000-0000-000000000002", R3="00000000-0000-0000-0000-000000000003";
await db.exec(`
insert into auth.users values ('${A}','a'),('${R1}','r1'),('${R2}','r2'),('${R3}','r3');
insert into public.profiles values ('${A}','Admin','admin',null),('${R1}','Dr1','reviewer',1),('${R2}','Dr2','reviewer',2),('${R3}','Dr3','reviewer',3);
insert into public.cases (case_number, admission_text, sort_order) values ('101','t',1),('102','t',2),('103','t',3);
`);
let pass=0, fail=0;
const check=(name, ok)=>{ console.log((ok?"PASS ":"FAIL ")+name); if (ok) pass++; else fail++; };
async function as(uid, fn){ await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`); try { return await fn(); } finally { await db.exec(`reset role;`);} }
async function err(fn){ try{ await fn(); return null;}catch(e){ return e.message; } }

await as(R1, ()=>q(`insert into ratings (case_id, reviewer_id, rating) values (1,'${R1}','resident'),(2,'${R1}','specialist')`));
await as(R2, ()=>q(`insert into ratings (case_id, reviewer_id, rating) values (1,'${R2}','specialist')`));

check("R2 sees only own ratings", (await as(R2, ()=>q(`select * from ratings`))).rows.length === 1);
check("R2 cannot read R1 ratings by filter", (await as(R2, ()=>q(`select * from ratings where reviewer_id='${R1}'`))).rows.length === 0);
check("R2 cannot insert rating as R1", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, rating) values (3,'${R1}','resident')`)))));
const upd = await as(R2, ()=>q(`update ratings set rating='resident' where reviewer_id='${R1}'`));
check("R2 cannot update R1 rating", upd.affectedRows === 0);
check("R2 cannot delete", !!(await as(R2, ()=>err(()=>q(`delete from ratings`)))));
check("R2 cannot read audit log", (await as(R2, ()=>q(`select * from rating_events`))).rows.length === 0);
check("R2 cannot read others' profiles", (await as(R2, ()=>q(`select * from profiles`))).rows.length === 1);
check("R2 cannot promote self to admin", !!(await as(R2, ()=>err(()=>q(`update profiles set role='admin' where id='${R2}'`)))));
check("R2 cannot write cases", !!(await as(R2, ()=>err(()=>q(`insert into cases (case_number, admission_text, sort_order) values ('x','y',9)`)))));
check("Reviewer can read cases", (await as(R2, ()=>q(`select * from cases`))).rows.length === 3);
check("Invalid rating value rejected", !!(await as(R2, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, rating) values (2,'${R2}','maybe')`)))));
check("Admin sees all ratings", (await as(A, ()=>q(`select * from ratings`))).rows.length === 3);
check("Admin cannot rate", !!(await as(A, ()=>err(()=>q(`insert into ratings (case_id, reviewer_id, rating) values (3,'${A}','resident')`)))));
check("Admin sees all profiles", (await as(A, ()=>q(`select * from profiles`))).rows.length === 4);
// queue
check("Queue R1 after 0 -> case 3", (await as(R1, ()=>q(`select next_unrated_case(0) as id`))).rows[0].id == 3);
check("Queue R2 after 2 -> case 3", (await as(R2, ()=>q(`select next_unrated_case(2) as id`))).rows[0].id == 3);
check("Queue R2 after 3 wraps -> case 2", (await as(R2, ()=>q(`select next_unrated_case(3) as id`))).rows[0].id == 2);
// edit + audit
await as(R1, ()=>q(`insert into ratings (case_id, reviewer_id, rating) values (1,'${R1}','specialist') on conflict (case_id, reviewer_id) do update set rating = excluded.rating`));
check("Upsert changes own rating", (await as(R1, ()=>q(`select rating from ratings where case_id=1`))).rows[0].rating === "specialist");
check("Audit logged the change", (await as(A, ()=>q(`select * from rating_events where case_id=1 and reviewer_id='${R1}' order by id`))).rows.map(r=>r.new_rating).join(",") === "resident,specialist");
// reviewer_state
await as(R1, ()=>q(`insert into reviewer_state (reviewer_id, last_sort_order) values ('${R1}', 2) on conflict (reviewer_id) do update set last_sort_order = excluded.last_sort_order`));
check("R2 cannot see R1 position", (await as(R2, ()=>q(`select * from reviewer_state`))).rows.length === 0);
// anon
await db.exec(`set role anon;`);
check("Anon cannot read cases", !!(await err(()=>q(`select * from cases`))));
check("Anon cannot read ratings", !!(await err(()=>q(`select * from ratings`))));
await db.exec(`reset role;`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
