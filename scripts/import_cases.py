"""One-time import of the cases Excel into Supabase.

Only three columns are read: patient serial number, admission text and
ultrasound findings. The empty reviewer columns are ignored - ratings live in
the app.

Run with --dry-run first to check the column mapping and the row count.

Usage:
  python scripts/import_cases.py data/cases.xlsx --dry-run
  python scripts/import_cases.py data/cases.xlsx \
      --id-col "<header>" --admission-col "<header>" --us-col "<header>"

Without the --*-col flags the first three columns are used, in that order.
Cases whose serial number already exists are skipped, never overwritten, so
existing ratings always stay attached to the text they were given for.
"""

import argparse
import math
import sys

import pandas as pd


def clean(value) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # Excel stores 17 as 17.0
    text = str(value).strip()
    return text or None


def pick(df: pd.DataFrame, given: str | None, index: int, what: str) -> str:
    if given:
        if given not in df.columns:
            sys.exit(f"Column '{given}' for {what} not found. Columns: {list(df.columns)}")
        return given
    if index >= len(df.columns):
        sys.exit(f"The sheet has fewer than {index + 1} columns.")
    return df.columns[index]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx")
    ap.add_argument("--sheet", default=0, help="Sheet name or index (default: first)")
    ap.add_argument("--id-col")
    ap.add_argument("--admission-col")
    ap.add_argument("--us-col")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sheet = int(args.sheet) if str(args.sheet).isdigit() else args.sheet
    df = pd.read_excel(args.xlsx, sheet_name=sheet, dtype=object)
    id_col = pick(df, args.id_col, 0, "patient serial number")
    adm_col = pick(df, args.admission_col, 1, "admission text")
    us_col = pick(df, args.us_col, 2, "ultrasound findings")

    print("Column mapping:")
    print(f"  serial number : {id_col}")
    print(f"  admission     : {adm_col}")
    print(f"  ultrasound    : {us_col}")

    rows, problems, seen = [], [], set()
    for i, r in df.iterrows():
        excel_row = i + 2  # header is row 1
        number = clean(r[id_col])
        admission = clean(r[adm_col])
        if number is None and admission is None:
            continue  # blank line
        if number is None:
            problems.append(f"row {excel_row}: missing serial number")
            continue
        if admission is None:
            problems.append(f"row {excel_row}: serial {number} has no admission text")
            continue
        if number in seen:
            problems.append(f"row {excel_row}: duplicate serial {number}")
            continue
        seen.add(number)
        rows.append({"case_number": number, "admission_text": admission, "ultrasound_text": clean(r[us_col])})

    print(f"\nValid cases: {len(rows)}   with ultrasound: {sum(1 for x in rows if x['ultrasound_text'])}")
    if problems:
        print(f"\n{len(problems)} problem(s) - fix them in the Excel and re-run:")
        for p in problems:
            print("  " + p)
        sys.exit(1)

    if args.dry_run:
        print("\nDry run only - nothing was written.")
        return

    from common import admin_client

    client = admin_client()
    existing, start = [], 0
    while True:  # page through: one response returns at most 1000 rows
        batch = client.table("cases").select("case_number, sort_order").range(start, start + 999).execute().data
        existing += batch
        if len(batch) < 1000:
            break
        start += 1000
    known = {e["case_number"] for e in existing}
    next_order = max((e["sort_order"] for e in existing), default=0) + 1

    new_rows = []
    for row in rows:
        if row["case_number"] in known:
            continue
        new_rows.append({**row, "sort_order": next_order})
        next_order += 1

    for start in range(0, len(new_rows), 500):
        client.table("cases").insert(new_rows[start : start + 500]).execute()

    print(f"\nImported {len(new_rows)} new case(s); skipped {len(rows) - len(new_rows)} that already existed.")


if __name__ == "__main__":
    main()
