// Unit tests for lib/stats.ts.  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, cohenKappa, fleissKappa, summarize, type RatingRow } from "../src/lib/stats.ts";

const J = "junior" as const;
const S = "senior" as const;
const NA = "not_applicable" as const;
const two = [J, S] as const;
const three = [J, S, NA] as const;

test("Fleiss: perfect agreement with both categories = 1", () => {
  assert.equal(fleissKappa([[J, J, J], [S, S, S]], two), 1);
});

test("Fleiss: matches hand calculation for two categories", () => {
  // P_i: 1, 1/3, 1/3, 1 -> Pbar = 2/3. p_j = 1/2 each -> Pe = 0.5. kappa = 1/3.
  const k = fleissKappa([[J, J, J], [J, J, S], [S, S, J], [S, S, S]], two);
  assert.ok(Math.abs(k! - 1 / 3) < 1e-12);
});

test("Fleiss: matches hand calculation for three categories", () => {
  // Rows: JJJ, SSS, NNN, JSN -> P_i = 1, 1, 1, 0 -> Pbar = 3/4.
  // p_j = 4/12 each -> Pe = 1/3. kappa = (3/4 - 1/3) / (2/3) = 5/8.
  const k = fleissKappa([[J, J, J], [S, S, S], [NA, NA, NA], [J, S, NA]], three);
  assert.ok(Math.abs(k! - 5 / 8) < 1e-12);
});

test("Fleiss: undefined when everyone always picks one category", () => {
  assert.equal(fleissKappa([[J, J, J], [J, J, J]], two), null);
});

test("Cohen: textbook 2x2 example", () => {
  // 20 agree-J, 15 agree-S, 5 J/S, 10 S/J -> po=0.7, pe=0.5 -> kappa 0.4
  const pairs: [typeof J | typeof S, typeof J | typeof S][] = [
    ...Array(20).fill([J, J]), ...Array(15).fill([S, S]), ...Array(5).fill([J, S]), ...Array(10).fill([S, J]),
  ];
  const { kappa, agreement, n } = cohenKappa(pairs, two);
  assert.equal(n, 50);
  assert.ok(Math.abs(agreement! - 0.7) < 1e-12);
  assert.ok(Math.abs(kappa! - 0.4) < 1e-12);
});

test("Cohen: three categories", () => {
  // po = 2/4. pa = pb = (2/4 J, 1/4 S, 1/4 N) -> pe = 1/4 + 1/16 + 1/16 = 3/8.
  // kappa = (1/2 - 3/8) / (5/8) = 1/5.
  const { kappa } = cohenKappa([[J, J], [J, S], [S, J], [NA, NA]], three);
  assert.ok(Math.abs(kappa! - 0.2) < 1e-12);
});

const cases = [1, 2, 3].map((id) => ({ id, case_number: String(id), admission_text: "", ultrasound_text: null, sort_order: id }));
const reviewers = [
  { id: "a", display_name: "A", reviewer_slot: 1 },
  { id: "b", display_name: "B", reviewer_slot: 2 },
  { id: "c", display_name: "C", reviewer_slot: 3 },
];
const r = (case_id: number, reviewer_id: string, stage: "entry" | "operative", rating: typeof J | typeof S | typeof NA): RatingRow => ({
  case_id, reviewer_id, stage, rating, updated_at: "",
});
const ratings = [
  r(1, "a", "entry", J), r(1, "b", "entry", J), r(1, "c", "entry", S),
  r(1, "a", "operative", NA), r(1, "b", "operative", NA), r(1, "c", "operative", NA),
  r(2, "a", "entry", S), r(2, "b", "entry", J),
];

test("summarize: per stage status, dispute and majority", () => {
  const [c1, c2, c3] = summarize(cases, reviewers, ratings);
  assert.deepEqual(c1.stages.entry, { bySlot: [J, J, S], count: 3, status: "complete", ambivalent: true, majority: J });
  assert.deepEqual(c1.stages.operative.majority, NA);
  assert.equal(c1.stages.operative.ambivalent, false);
  assert.equal(c1.status, "complete");
  assert.equal(c1.ambivalent, true);
  assert.equal(c2.stages.entry.majority, null); // one each: no majority
  assert.equal(c2.stages.operative.status, "unrated");
  assert.equal(c2.status, "partial");
  assert.equal(c3.status, "unrated");
});

test("analyze: per stage counts and agreement", () => {
  const a = analyze(summarize(cases, reviewers, ratings), reviewers);
  assert.equal(a.totalCases, 3);
  assert.equal(a.casesComplete, 1);
  assert.equal(a.casesUnrated, 1);
  assert.equal(a.casesDisputed, 2);
  assert.equal(a.stages.entry.ambivalent, 2);
  assert.equal(a.stages.operative.unanimous, 1);
  assert.deepEqual(a.stages.operative.majority, { junior: 0, senior: 0, not_applicable: 1 });
  assert.deepEqual(a.stages.entry.perReviewer[0].counts, { junior: 1, senior: 1, not_applicable: 0 });
  assert.equal(a.stages.entry.perReviewer[2].remaining, 2);
  assert.deepEqual(a.stages.operative.options, three);
});
