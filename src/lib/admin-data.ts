import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/dal";
import { chooseDataset, listDatasets } from "@/lib/datasets";
import { analyze, summarize, type CaseRow, type RatingRow, type Reviewer } from "@/lib/stats";
import type { Attribute } from "@/lib/export-sheet";

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
        .select("case_id, reviewer_id, rating, updated_at, cases!inner(dataset_id)")
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
