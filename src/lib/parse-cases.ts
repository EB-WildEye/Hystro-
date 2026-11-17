// Turns an uploaded spreadsheet (already read into rows) into cases.
//
// Every file has the same structure: patient serial number, admission text
// and ultrasound findings in the first three columns, then any number of
// annotation columns. Pure functions, unit-tested in tests/parse-cases.test.ts.

export type RawValue = string | number | boolean | Date | null | undefined;
export type RawSheet = { sheet: string; data: RawValue[][] };

export type ParsedCase = {
  case_number: string;
  admission_text: string;
  ultrasound_text: string | null;
  attributes: { name: string; value: string | null }[];
};

export type ParseResult =
  | { ok: true; sheet: string; cases: ParsedCase[]; attributeCount: number; withUltrasound: number }
  | { ok: false; problems: string[] };

export const MAX_CASES = 5000;

// Cell to trimmed text. Excel stores 17 as 17.0, and dates as Date objects.
export function cleanCell(value: RawValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  const text = String(value).replace(/\r\n?/g, "\n").trim();
  return text === "" ? null : text;
}

function headerOf(sheet: RawSheet): (string | null)[] {
  return (sheet.data[0] ?? []).map(cleanCell);
}

function dataRows(sheet: RawSheet): RawValue[][] {
  return sheet.data.slice(1).filter((row) => row.some((v) => cleanCell(v) !== null));
}

// A sheet that can hold cases: three named leading columns and at least one
// row with a serial number and an admission text.
function looksLikeCases(sheet: RawSheet): boolean {
  const header = headerOf(sheet);
  if (header.length < 3 || header.slice(0, 3).some((h) => h === null)) return false;
  return dataRows(sheet).some((r) => cleanCell(r[0]) !== null && cleanCell(r[1]) !== null);
}

function numericSerialShare(sheet: RawSheet): number {
  const serials = dataRows(sheet)
    .map((r) => cleanCell(r[0]))
    .filter((v): v is string => v !== null);
  return serials.length === 0 ? 0 : serials.filter((s) => /^\d+$/.test(s)).length / serials.length;
}

// Picks the sheet with the cases. A workbook may also hold a legend or notes
// sheet; when several sheets qualify, the one whose serial numbers are
// numbers wins. If that still leaves a tie, the admin must name the sheet.
export function pickSheet(sheets: RawSheet[], requested?: string): RawSheet | { problem: string } {
  const names = sheets.map((s) => s.sheet).join(", ");
  if (requested) {
    const match = sheets.find((s) => s.sheet === requested);
    return match ?? { problem: `אין בקובץ גיליון בשם "${requested}". הגיליונות בקובץ: ${names}` };
  }
  const candidates = sheets.filter(looksLikeCases);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    return { problem: `לא נמצא גיליון עם מספר מטופלת, קבלה ו-US בשלוש העמודות הראשונות. הגיליונות בקובץ: ${names}` };
  }
  const numeric = candidates.filter((s) => numericSerialShare(s) >= 0.9);
  if (numeric.length === 1) return numeric[0];
  return { problem: `בקובץ יש כמה גיליונות שיכולים להכיל קבלות: ${candidates.map((s) => s.sheet).join(", ")}. נא לכתוב את שם הגיליון.` };
}

export function parseCases(sheet: RawSheet, options: { usEmpty: string[] }): ParseResult {
  const header = headerOf(sheet);
  const attributeColumns = header
    .map((name, index) => ({ name, index }))
    .filter((c): c is { name: string; index: number } => c.index >= 3 && c.name !== null);

  const cases: ParsedCase[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  sheet.data.slice(1).forEach((row, i) => {
    const excelRow = i + 2; // the header is row 1
    const number = cleanCell(row[0]);
    const admission = cleanCell(row[1]);
    if (number === null && admission === null) return; // blank line or stray notes below the table
    if (number === null) return void problems.push(`שורה ${excelRow}: חסר מספר מטופלת`);
    if (admission === null) return void problems.push(`שורה ${excelRow}: למטופלת ${number} אין טקסט קבלה`);
    if (seen.has(number)) return void problems.push(`שורה ${excelRow}: מספר מטופלת ${number} מופיע פעמיים`);
    seen.add(number);

    const ultrasound = cleanCell(row[2]);
    cases.push({
      case_number: number,
      admission_text: admission,
      // A placeholder such as 0 means "no ultrasound", not a finding.
      ultrasound_text: ultrasound !== null && options.usEmpty.includes(ultrasound) ? null : ultrasound,
      attributes: attributeColumns.map((c) => ({ name: c.name, value: cleanCell(row[c.index]) })),
    });
  });

  if (cases.length === 0 && problems.length === 0) problems.push("לא נמצאו קבלות בגיליון");
  if (cases.length > MAX_CASES) problems.push(`בקובץ ${cases.length} קבלות, והמקסימום הוא ${MAX_CASES}`);
  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    sheet: sheet.sheet,
    cases,
    attributeCount: attributeColumns.length,
    withUltrasound: cases.filter((c) => c.ultrasound_text !== null).length,
  };
}

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes.
// The delimiter is detected from the header line (comma, semicolon or tab),
// since Excel saves Hebrew-locale CSV files with semicolons or tabs at times.
export function parseCsv(text: string): RawValue[][] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.slice(0, body.search(/\r?\n|$/));
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );

  const rows: RawValue[][] = [];
  let row: RawValue[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// CSV bytes to text: UTF-8 when valid, otherwise Windows-1255, the encoding a
// Hebrew-locale Excel uses for plain "CSV" files.
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1255").decode(bytes);
  }
}
