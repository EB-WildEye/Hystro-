// Unit tests for lib/parse-cases.ts.  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCell, decodeCsv, parseCases, parseCsv, pickSheet, type RawSheet } from "../src/lib/parse-cases.ts";

const cases: RawSheet = {
  sheet: "Sheet1",
  data: [
    ["מספר מטופלת", "קבלה", "US מיילדותי", "age_years", null, "pathology_type"],
    [1, "בת 42\r\nללא ילדים ", 0, "בת 42", "ignored", "פוליפ"],
    [2, "בת 50", "רחם קדמי", null, null, null],
    [null, null, null, null, null, null],
    [null, null, "1", null, null, null], // stray cell below the table
  ],
};
const legend: RawSheet = { sheet: "מקרא", data: [["מקרא צבעים", null], ["צהוב", "הושלם"]] };
const lookup: RawSheet = {
  sheet: "גיליון1",
  data: [["cervical_stenosis", "nulliparous", "postmenopausal"], ["הצרות צוואר הרחם", "ללא ילדים", "אל וסת"]],
};

test("cleanCell trims, normalises numbers, dates and line breaks", () => {
  assert.equal(cleanCell(17), "17");
  assert.equal(cleanCell("  a\r\nb "), "a\nb");
  assert.equal(cleanCell(""), null);
  assert.equal(cleanCell(new Date("2026-11-17T00:00:00Z")), "2026-11-17");
});

test("pickSheet skips a legend sheet and a lookup sheet", () => {
  const picked = pickSheet([legend, cases, lookup]);
  assert.ok("sheet" in picked);
  assert.equal(picked.sheet, "Sheet1");
});

test("pickSheet honours a requested sheet and reports unknown names", () => {
  assert.equal((pickSheet([legend, cases], "מקרא") as RawSheet).sheet, "מקרא");
  assert.ok("problem" in pickSheet([cases], "nope"));
});

test("pickSheet asks for a name when two sheets both qualify", () => {
  assert.ok("problem" in pickSheet([cases, { ...cases, sheet: "Copy" }]));
});

test("parseCases reads cases, maps placeholders and keeps named annotation columns", () => {
  const result = parseCases(cases, { usEmpty: ["0"] });
  assert.ok(result.ok);
  assert.equal(result.cases.length, 2);
  assert.deepEqual(result.cases[0], {
    case_number: "1",
    admission_text: "בת 42\nללא ילדים",
    ultrasound_text: null,
    attributes: [
      { name: "age_years", value: "בת 42" },
      { name: "pathology_type", value: "פוליפ" },
    ],
  });
  assert.equal(result.cases[1].ultrasound_text, "רחם קדמי");
  assert.equal(result.attributeCount, 2);
  assert.equal(result.withUltrasound, 1);
});

test("parseCases lists every problem with its Excel row", () => {
  const bad: RawSheet = { sheet: "s", data: [["a", "b", "c"], [1, "x", null], [1, "y", null], [null, "z", null], [3, null, null]] };
  const result = parseCases(bad, { usEmpty: [] });
  assert.equal(result.ok, false);
  assert.deepEqual(!result.ok && result.problems, [
    "שורה 3: מספר מטופלת 1 מופיע פעמיים",
    "שורה 4: חסר מספר מטופלת",
    "שורה 5: למטופלת 3 אין טקסט קבלה",
  ]);
});

test("parseCsv handles quotes, embedded newlines and semicolons", () => {
  assert.deepEqual(parseCsv('﻿a;b;c\r\n1;"x;y";"line1\nline2 ""q"""\r\n'), [
    ["a", "b", "c"],
    ["1", "x;y", 'line1\nline2 "q"'],
  ]);
  assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("decodeCsv falls back to Windows-1255 for Hebrew Excel CSV", () => {
  const windows1255 = new Uint8Array([0xe1, 0xfa]); // "בת"
  assert.equal(decodeCsv(windows1255), "בת");
  assert.equal(decodeCsv(new TextEncoder().encode("בת")), "בת");
});
