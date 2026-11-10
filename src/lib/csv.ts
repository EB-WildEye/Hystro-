// RFC 4180 CSV with protection against spreadsheet formula injection
// (OWASP "CSV Injection"): cells starting with = + @ or a control character
// are prefixed with an apostrophe so Excel treats them as text.
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+@\t\r]/.test(s) || /^-[^\s\d]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // BOM so Excel opens Hebrew text as UTF-8.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
