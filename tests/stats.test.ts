// Unit tests for lib/stats.ts.  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cohenKappa, fleissKappa, summarize, analyze } from "../src/lib/stats.ts";

const R = "resident" as const;
const S = "specialist" as const;

test("Fleiss: perfect agreement with both categories = 1", () => {
  assert.equal(fleissKappa([[R, R, R], [S, S, S]]), 1);
});

test("Fleiss: matches hand calculation", () => {
  // P_i: 1, 1/3, 1/3, 1 -> Pbar = 2/3. p_res = 6/12 -> Pe = 0.5. kappa = 1/3.
  const k = fleissKappa([[R, R, R], [R, R, S], [S, S, R], [S, S, S]]);
  assert.ok(Math.abs(k! - 1 / 3) < 1e-12);
});

test("Fleiss: undefined when everyone always picks one category", () => {
  assert.equal(fleissKappa([[R, R, R], [R, R, R]]), null);
});

test("Cohen: textbook 2x2 example", () => {
  // 20 agree-R, 15 agree-S, 5 R/S, 10 S/R -> po=0.7, pe=0.5 -> kappa 0.4
  const pairs: [typeof R | typeof S, typeof R | typeof S][] = [
    ...Array(20).fill([R, R]), ...Array(15).fill([S, S]), ...Array(5).fill([R, S]), ...Array(10).fill([S, R]),
  ];
  const { kappa, agreement, n } = cohenKappa(pairs);
  assert.equal(n, 50);
  assert.ok(Math.abs(agreement! - 0.7) < 1e-12);
  assert.ok(Math.abs(kappa! - 0.4) < 1e-12);
});

test("summarize: status, ambivalence and majority", () => {
  const cases = [1, 2, 3, 4].map((id) => ({ id, case_number: String(id), admission_text: "", ultrasound_text: null, sort_order: id }));
  const reviewers = [
    { id: "a", display_name: "A", reviewer_slot: 1 },
    { id: "b", display_name: "B", reviewer_slot: 2 },
    { id: "c", display_name: "C", reviewer_slot: 3 },
  ];
  const t = "2026-01-01";
  const ratings = [
    { case_id: 1, reviewer_id: "a", rating: R, updated_at: t },
    { case_id: 1, reviewer_id: "b", rating: R, updated_at: t },
    { case_id: 1, reviewer_id: "c", rating: S, updated_at: t },
    { case_id: 2, reviewer_id: "a", rating: S, updated_at: t },
    { case_id: 2, reviewer_id: "b", rating: R, updated_at: t },
    { case_id: 3, reviewer_id: "c", rating: S, updated_at: t },
  ];
  const s = summarize(cases, reviewers, ratings);
  assert.deepEqual(s.map((x) => x.status), ["complete", "partial", "partial", "unrated"]);
  assert.deepEqual(s.map((x) => x.ambivalent), [true, true, false, false]);
  assert.deepEqual(s.map((x) => x.majority), [R, null, null, null]);
  const a = analyze(s, reviewers);
  assert.equal(a.ambivalent, 2);
  assert.equal(a.unrated, 1);
  assert.equal(a.perReviewer[2].remaining, 2);
});
