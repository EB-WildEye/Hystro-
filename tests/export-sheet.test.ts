// Unit tests for lib/export-sheet.ts.  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExportSheet, type Attribute } from "../src/lib/export-sheet.ts";
import { summarize } from "../src/lib/stats.ts";

const reviewers = [
  { id: "b", display_name: "B", reviewer_slot: 2 },
  { id: "a", display_name: "A", reviewer_slot: 1 },
];
const cases = [
  { id: 10, case_number: "7", admission_text: "בת 42", ultrasound_text: null, sort_order: 1 },
  { id: 11, case_number: "8", admission_text: "=HYPERLINK(1)", ultrasound_text: "פוליפ", sort_order: 2 },
];
const ratings = [
  { case_id: 10, reviewer_id: "a", rating: "resident" as const, updated_at: "" },
  { case_id: 10, reviewer_id: "b", rating: "specialist" as const, updated_at: "" },
];
const attributes = new Map<number, Attribute[]>([
  [10, [{ name: "age_years", value: "בת 42" }, { name: "pathology_type", value: "פוליפ" }]],
  [11, [{ name: "age_years", value: null }, { name: "pathology_type", value: "שרירן" }]],
]);

const { data, columns } = buildExportSheet(summarize(cases, reviewers, ratings), reviewers, attributes);
const header = data[0].map((c) => c.value);

test("columns: number, reviewers by slot, consensus, texts, then annotations in order", () => {
  assert.deepEqual(header, [
    "מספר מטופלת",
    "מעריך 1 - A",
    "מעריך 2 - B",
    "הכרעת רוב",
    "חילוקי דעות",
    "מספר דירוגים",
    "קבלה",
    "ממצאי אולטרסאונד שהוצגו למדרגים",
    "age_years",
    "pathology_type",
  ]);
  assert.equal(columns.length, header.length);
});

test("one row per case with ratings in reviewer columns", () => {
  assert.equal(data.length, 3);
  assert.deepEqual(data[1].slice(0, 6).map((c) => c.value), [7, "מתמחה", "מומחה", undefined, "כן", 2]);
  assert.deepEqual(data[1].slice(8).map((c) => c.value), ["בת 42", "פוליפ"]);
});

test("text that looks like a formula stays text", () => {
  const cell = data[2][6];
  assert.equal(cell.value, "=HYPERLINK(1)");
  assert.equal(cell.type, String);
});

test("text cells are right-aligned and wrapped", () => {
  const cell = data[1][6];
  assert.equal(cell.align, "right");
  assert.equal(cell.wrap, true);
});
