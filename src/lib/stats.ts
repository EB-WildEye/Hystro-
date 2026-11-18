import { STAGE_OPTIONS, STAGES, type Rating, type Stage } from "./labels.ts";

// Pure statistics over the rating matrix. No I/O, so it is unit-tested
// directly (see tests/stats.test.ts). Every case has two stages (entry,
// operative); each stage is summarised and analysed on its own, with the
// answer options that stage offers as nominal categories.

export type CaseRow = {
  id: number;
  case_number: string;
  admission_text: string;
  ultrasound_text: string | null;
  sort_order: number;
};

export type Reviewer = { id: string; display_name: string; reviewer_slot: number };

export type RatingRow = { case_id: number; reviewer_id: string; stage: Stage; rating: Rating; updated_at: string };

export type Status = "unrated" | "partial" | "complete";

export type StageSummary = {
  bySlot: (Rating | null)[]; // index 0..2 = reviewer slot 1..3
  count: number;
  status: Status;
  ambivalent: boolean; // >= 2 ratings that are not all identical
  majority: Rating | null; // a rating given by >= 2 reviewers and by more than any other
};

export type CaseSummary = {
  case: CaseRow;
  stages: Record<Stage, StageSummary>;
  status: Status; // complete when every reviewer rated both stages
  ambivalent: boolean; // disputed in at least one stage
};

function statusOf(given: number, of: number): Status {
  return given === 0 ? "unrated" : given === of ? "complete" : "partial";
}

function summarizeStage(bySlot: (Rating | null)[], raters: number): StageSummary {
  const given = bySlot.filter((v): v is Rating => v !== null);
  const counts = new Map<Rating, number>();
  for (const v of given) counts.set(v, (counts.get(v) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const majority = top && top[1] >= 2 && (!second || top[1] > second[1]) ? top[0] : null;
  return {
    bySlot,
    count: given.length,
    status: statusOf(given.length, raters),
    ambivalent: given.length >= 2 && counts.size > 1,
    majority,
  };
}

export function summarize(cases: CaseRow[], reviewers: Reviewer[], ratings: RatingRow[]): CaseSummary[] {
  const slotOf = new Map(reviewers.map((r) => [r.id, r.reviewer_slot]));
  const raters = Math.max(reviewers.length, 1);
  const grid = new Map<number, Record<Stage, (Rating | null)[]>>();
  for (const c of cases) grid.set(c.id, { entry: [null, null, null], operative: [null, null, null] });
  for (const r of ratings) {
    const slot = slotOf.get(r.reviewer_id);
    const row = grid.get(r.case_id);
    if (slot && row) row[r.stage][slot - 1] = r.rating;
  }
  return cases.map((c) => {
    const row = grid.get(c.id)!;
    const stages = {
      entry: summarizeStage(row.entry, raters),
      operative: summarizeStage(row.operative, raters),
    };
    const given = stages.entry.count + stages.operative.count;
    return {
      case: c,
      stages,
      status: statusOf(given, raters * STAGES.length),
      ambivalent: stages.entry.ambivalent || stages.operative.ambivalent,
    };
  });
}

// Fleiss' kappa for a fixed number of raters per subject and any number of
// nominal categories (Fleiss, 1971). Returns null when undefined.
export function fleissKappa(matrix: Rating[][], categories: readonly Rating[]): number | null {
  if (matrix.length === 0) return null;
  const n = matrix[0].length;
  if (n < 2) return null;
  if (matrix.some((r) => r.length !== n)) throw new Error("Fleiss' kappa needs the same rater count per subject");
  const N = matrix.length;
  const totals = new Map<Rating, number>(categories.map((c) => [c, 0]));
  let pBarSum = 0;
  for (const row of matrix) {
    let sumSquares = 0;
    for (const c of categories) {
      const nij = row.filter((v) => v === c).length;
      totals.set(c, totals.get(c)! + nij);
      sumSquares += nij * nij;
    }
    pBarSum += (sumSquares - n) / (n * (n - 1));
  }
  const pBar = pBarSum / N;
  const pe = categories.reduce((sum, c) => sum + (totals.get(c)! / (N * n)) ** 2, 0);
  if (pe === 1) return null;
  return (pBar - pe) / (1 - pe);
}

// Cohen's kappa for two raters on the subjects both rated (Cohen, 1960).
export function cohenKappa(
  pairs: [Rating, Rating][],
  categories: readonly Rating[],
): { kappa: number | null; agreement: number | null; n: number } {
  const n = pairs.length;
  if (n === 0) return { kappa: null, agreement: null, n };
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pe = categories.reduce((sum, c) => {
    const pa = pairs.filter(([a]) => a === c).length / n;
    const pb = pairs.filter(([, b]) => b === c).length / n;
    return sum + pa * pb;
  }, 0);
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

export type StageAnalytics = {
  stage: Stage;
  options: readonly Rating[];
  complete: number;
  partial: number;
  unrated: number;
  ambivalent: number;
  unanimous: number;
  perReviewer: { reviewer: Reviewer; rated: number; remaining: number; counts: Record<Rating, number> }[];
  fleiss: number | null;
  fleissN: number;
  pairwise: { a: Reviewer; b: Reviewer; kappa: number | null; agreement: number | null; n: number }[];
  majority: Record<Rating, number>;
};

export type Analytics = {
  totalCases: number;
  casesComplete: number; // every reviewer rated both stages
  casesUnrated: number;
  casesDisputed: number; // disputed in at least one stage
  stages: Record<Stage, StageAnalytics>;
};

function zeroCounts(): Record<Rating, number> {
  return { junior: 0, senior: 0, not_applicable: 0 };
}

function analyzeStage(stage: Stage, summaries: CaseSummary[], sorted: Reviewer[]): StageAnalytics {
  const options = STAGE_OPTIONS[stage];
  const rows = summaries.map((s) => s.stages[stage]);
  const complete = rows.filter((r) => r.status === "complete");

  const perReviewer = sorted.map((reviewer) => {
    const counts = zeroCounts();
    for (const r of rows) {
      const v = r.bySlot[reviewer.reviewer_slot - 1];
      if (v) counts[v]++;
    }
    const rated = counts.junior + counts.senior + counts.not_applicable;
    return { reviewer, rated, remaining: rows.length - rated, counts };
  });

  const pairwise: StageAnalytics["pairwise"] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const pairs: [Rating, Rating][] = [];
      for (const r of rows) {
        const va = r.bySlot[a.reviewer_slot - 1];
        const vb = r.bySlot[b.reviewer_slot - 1];
        if (va && vb) pairs.push([va, vb]);
      }
      pairwise.push({ a, b, ...cohenKappa(pairs, options) });
    }
  }

  const majority = zeroCounts();
  for (const r of rows) if (r.majority) majority[r.majority]++;

  const fullMatrix = complete.map((r) => r.bySlot.slice(0, sorted.length) as Rating[]);
  return {
    stage,
    options,
    complete: complete.length,
    partial: rows.filter((r) => r.status === "partial").length,
    unrated: rows.filter((r) => r.status === "unrated").length,
    ambivalent: rows.filter((r) => r.ambivalent).length,
    unanimous: complete.filter((r) => !r.ambivalent).length,
    perReviewer,
    fleiss: sorted.length >= 3 ? fleissKappa(fullMatrix, options) : null,
    fleissN: fullMatrix.length,
    pairwise,
    majority,
  };
}

export function analyze(summaries: CaseSummary[], reviewers: Reviewer[]): Analytics {
  const sorted = [...reviewers].sort((x, y) => x.reviewer_slot - y.reviewer_slot);
  return {
    totalCases: summaries.length,
    casesComplete: summaries.filter((s) => s.status === "complete").length,
    casesUnrated: summaries.filter((s) => s.status === "unrated").length,
    casesDisputed: summaries.filter((s) => s.ambivalent).length,
    stages: {
      entry: analyzeStage("entry", summaries, sorted),
      operative: analyzeStage("operative", summaries, sorted),
    },
  };
}
