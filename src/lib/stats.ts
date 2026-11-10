import type { Rating } from "./labels";

// Pure statistics over the rating matrix. No I/O, so it is unit-tested
// directly (see tests/stats.test.ts).

export type CaseRow = {
  id: number;
  case_number: string;
  admission_text: string;
  ultrasound_text: string | null;
  sort_order: number;
};

export type Reviewer = { id: string; display_name: string; reviewer_slot: number };

export type RatingRow = { case_id: number; reviewer_id: string; rating: Rating; updated_at: string };

export type CaseSummary = {
  case: CaseRow;
  bySlot: (Rating | null)[]; // index 0..2 = reviewer slot 1..3
  count: number;
  status: "unrated" | "partial" | "complete";
  ambivalent: boolean; // >= 2 ratings that are not all identical
  majority: Rating | null; // only when >= 2 ratings agree and outnumber the rest
};

export function summarize(cases: CaseRow[], reviewers: Reviewer[], ratings: RatingRow[]): CaseSummary[] {
  const slotOf = new Map(reviewers.map((r) => [r.id, r.reviewer_slot]));
  const grid = new Map<number, (Rating | null)[]>();
  for (const c of cases) grid.set(c.id, [null, null, null]);
  for (const r of ratings) {
    const slot = slotOf.get(r.reviewer_id);
    const row = grid.get(r.case_id);
    if (slot && row) row[slot - 1] = r.rating;
  }
  return cases.map((c) => {
    const bySlot = grid.get(c.id)!;
    const given = bySlot.filter((v): v is Rating => v !== null);
    const resident = given.filter((v) => v === "resident").length;
    const specialist = given.length - resident;
    let majority: Rating | null = null;
    if (given.length >= 2 && resident !== specialist) {
      const top = resident > specialist ? "resident" : "specialist";
      if (Math.max(resident, specialist) >= 2) majority = top;
    }
    return {
      case: c,
      bySlot,
      count: given.length,
      status: given.length === 0 ? "unrated" : given.length === 3 ? "complete" : "partial",
      ambivalent: given.length >= 2 && resident > 0 && specialist > 0,
      majority,
    };
  });
}

// Fleiss' kappa for a fixed number of raters per subject (Fleiss, 1971).
// Uses only subjects rated by all raters. Returns null when undefined.
export function fleissKappa(matrix: Rating[][]): number | null {
  const rows = matrix.filter((r) => r.length >= 2);
  if (rows.length === 0) return null;
  const n = rows[0].length;
  if (rows.some((r) => r.length !== n)) throw new Error("Fleiss' kappa needs the same rater count per subject");
  const N = rows.length;
  let pBarSum = 0;
  let residentTotal = 0;
  for (const r of rows) {
    const a = r.filter((v) => v === "resident").length;
    const b = n - a;
    residentTotal += a;
    pBarSum += (a * a + b * b - n) / (n * (n - 1));
  }
  const pBar = pBarSum / N;
  const pRes = residentTotal / (N * n);
  const pe = pRes * pRes + (1 - pRes) * (1 - pRes);
  if (pe === 1) return null;
  return (pBar - pe) / (1 - pe);
}

// Cohen's kappa for two raters on the cases both rated (Cohen, 1960).
export function cohenKappa(pairs: [Rating, Rating][]): { kappa: number | null; agreement: number | null; n: number } {
  const n = pairs.length;
  if (n === 0) return { kappa: null, agreement: null, n };
  let agree = 0;
  let aRes = 0;
  let bRes = 0;
  for (const [a, b] of pairs) {
    if (a === b) agree++;
    if (a === "resident") aRes++;
    if (b === "resident") bRes++;
  }
  const po = agree / n;
  const pa = aRes / n;
  const pb = bRes / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  return { kappa: pe === 1 ? null : (po - pe) / (1 - pe), agreement: po, n };
}

// Landis & Koch (1977) descriptive bands.
export function kappaBand(k: number | null): string {
  if (k === null) return "לא ניתן לחישוב";
  if (k < 0) return "חלשה מהמקרי";
  if (k <= 0.2) return "קלה";
  if (k <= 0.4) return "הוגנת";
  if (k <= 0.6) return "בינונית";
  if (k <= 0.8) return "משמעותית";
  return "כמעט מלאה";
}

export type Analytics = {
  totalCases: number;
  complete: number;
  partial: number;
  unrated: number;
  ambivalent: number;
  unanimous: number;
  perReviewer: { reviewer: Reviewer; rated: number; remaining: number; resident: number; specialist: number }[];
  fleiss: number | null;
  fleissN: number;
  pairwise: { a: Reviewer; b: Reviewer; kappa: number | null; agreement: number | null; n: number }[];
  majority: { resident: number; specialist: number };
};

export function analyze(summaries: CaseSummary[], reviewers: Reviewer[]): Analytics {
  const sorted = [...reviewers].sort((x, y) => x.reviewer_slot - y.reviewer_slot);
  const complete = summaries.filter((s) => s.status === "complete");
  const perReviewer = sorted.map((reviewer) => {
    const col = summaries.map((s) => s.bySlot[reviewer.reviewer_slot - 1]);
    const resident = col.filter((v) => v === "resident").length;
    const specialist = col.filter((v) => v === "specialist").length;
    return { reviewer, rated: resident + specialist, remaining: summaries.length - resident - specialist, resident, specialist };
  });
  const pairwise: Analytics["pairwise"] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const pairs: [Rating, Rating][] = [];
      for (const s of summaries) {
        const va = s.bySlot[a.reviewer_slot - 1];
        const vb = s.bySlot[b.reviewer_slot - 1];
        if (va && vb) pairs.push([va, vb]);
      }
      pairwise.push({ a, b, ...cohenKappa(pairs) });
    }
  }
  const fullMatrix = complete.map((s) => s.bySlot as Rating[]);
  return {
    totalCases: summaries.length,
    complete: complete.length,
    partial: summaries.filter((s) => s.status === "partial").length,
    unrated: summaries.filter((s) => s.status === "unrated").length,
    ambivalent: summaries.filter((s) => s.ambivalent).length,
    unanimous: complete.filter((s) => !s.ambivalent).length,
    perReviewer,
    fleiss: sorted.length === 3 ? fleissKappa(fullMatrix) : null,
    fleissN: fullMatrix.length,
    pairwise,
    majority: {
      resident: summaries.filter((s) => s.majority === "resident").length,
      specialist: summaries.filter((s) => s.majority === "specialist").length,
    },
  };
}
