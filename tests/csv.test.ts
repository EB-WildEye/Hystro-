import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../src/lib/csv.ts";

test("quotes and escapes", () => assert.equal(csvCell('a "b",\nc'), '"a ""b"",\nc"'));
test("blocks formula injection", () => assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`));
test("keeps clinical bullets and negatives", () => {
  assert.equal(csvCell("- כאבים"), '"- כאבים"');
  assert.equal(csvCell("-5"), '"-5"');
});
test("starts with BOM for Excel", () => assert.ok(toCsv([["א"]]).startsWith("﻿")));
