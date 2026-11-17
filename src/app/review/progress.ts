import "server-only";
import { createClient } from "@/lib/supabase/server";

// Cases in a dataset and how many of them this reviewer has rated.
export async function datasetProgress(datasetId: number, reviewerId: string) {
  const supabase = await createClient();
  const [{ count: total, error: e1 }, { count: done, error: e2 }] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("dataset_id", datasetId),
    supabase
      .from("ratings")
      .select("id, cases!inner(dataset_id)", { count: "exact", head: true })
      .eq("reviewer_id", reviewerId)
      .eq("cases.dataset_id", datasetId),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  return { total: total ?? 0, done: done ?? 0 };
}
