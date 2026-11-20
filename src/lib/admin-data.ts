import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/dal";
import { chooseDataset, listDatasets } from "@/lib/datasets";
import { analyze, summarize, type CaseRow, type RatingRow, type Reviewer } from "@/lib/stats";
import type { Attribute } from "@/lib/export-sheet";
import type { Rating, Stage } from "@/lib/labels";

const PAGE = 1000; // Supabase caps a single response at 1000 rows by default.

async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

// Loads the full rating matrix of one dataset. Access is checked twice:
// requireAdmin() here, and the admin-only RLS policies in the database.
export async function loadAdminData(datasetId: number) {
  await requireAdmin();
  const supabase = await createClient();

  const [cases, ratings, reviewersRes] = await Promise.all([
    fetchAll<CaseRow>((from, to) =>
      supabase
        .from("cases")
        .select("id, case_number, admission_text, ultrasound_text, sort_order")
        .eq("dataset_id", datasetId)
        .order("sort_order")
        .range(from, to),
    ),
    fetchAll<RatingRow>((from, to) =>
      supabase
        .from("ratings")
        .select("case_id, reviewer_id, stage, rating, updated_at, cases!inner(dataset_id)")
        .eq("cases.dataset_id", datasetId)
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("profiles")
      .select("id, display_name, reviewer_slot")
      .eq("role", "reviewer")
      .order("reviewer_slot"),
  ]);
  if (reviewersRes.error) throw new Error(reviewersRes.error.message);
  const reviewers = (reviewersRes.data ?? []) as Reviewer[];

  const summaries = summarize(cases, reviewers, ratings);
  return { reviewers, summaries, analytics: analyze(summaries, reviewers), generatedAt: new Date() };
}

// Annotation columns from the source spreadsheet, by case id. Admin-only:
// reviewers rate without them, and RLS keeps the table from them.
export async function loadCaseAttributes(datasetId: number): Promise<Map<number, Attribute[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const rows = await fetchAll<{ case_id: number; attributes: Attribute[] }>((from, to) =>
    supabase
      .from("case_attributes")
      .select("case_id, attributes, cases!inner(dataset_id)")
      .eq("cases.dataset_id", datasetId)
      .order("case_id")
      .range(from, to),
  );
  return new Map(rows.map((r) => [r.case_id, r.attributes]));
}

// The admin's datasets and the one the page is about (?dataset=ID).
export async function adminContext(requested: unknown) {
  const profile = await requireAdmin();
  const datasets = await listDatasets();
  return { profile, datasets, dataset: chooseDataset(datasets, requested) };
}

export type Tester = { id: string; display_name: string };

// Testers' ratings for one dataset, kept apart from the study data: one row
// per case that at least one tester rated, in sheet order.
export async function loadTesterData(datasetId: number) {
  await requireAdmin();
  const supabase = await createClient();
  const testersRes = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("role", "tester")
    .order("display_name");
  if (testersRes.error) throw new Error(testersRes.error.message);
  const testers = (testersRes.data ?? []) as Tester[];
  if (testers.length === 0) return { testers, rows: [] };

  type Row = { stage: Stage; rating: Rating; reviewer_id: string; cases: unknown };
  type CaseRef = { id: number; case_number: string; sort_order: number };
  const ratings = await fetchAll<Row>((from, to) =>
    supabase
      .from("ratings")
      .select("stage, rating, reviewer_id, cases!inner(id, case_number, sort_order, dataset_id)")
      .eq("cases.dataset_id", datasetId)
      .in(
        "reviewer_id",
        testers.map((t) => t.id),
      )
      .order("id")
      .range(from, to),
  );

  const byCase = new Map<
    number,
    { caseId: number; caseNumber: string; sortOrder: number; ratings: Map<string, Partial<Record<Stage, Rating>>> }
  >();
  for (const r of ratings) {
    // A to-one embed; the untyped client describes it as a list.
    const c = r.cases as CaseRef;
    const row = byCase.get(c.id) ?? { caseId: c.id, caseNumber: c.case_number, sortOrder: c.sort_order, ratings: new Map() };
    const own = row.ratings.get(r.reviewer_id) ?? {};
    own[r.stage] = r.rating;
    row.ratings.set(r.reviewer_id, own);
    byCase.set(c.id, row);
  }
  return { testers, rows: [...byCase.values()].sort((a, b) => a.sortOrder - b.sortOrder) };
}
