import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Dataset = { id: number; name: string; is_active: boolean; created_at: string };

// Datasets the caller may see: RLS gives reviewers the active ones and the
// admin all of them. Newest first.
export async function listDatasets(): Promise<Dataset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("datasets")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Dataset[];
}

export function parseId(value: unknown): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// The dataset named in the URL when it is visible, otherwise the newest
// active one, otherwise the newest of all.
export function chooseDataset(datasets: Dataset[], requested: unknown): Dataset | null {
  const id = parseId(requested);
  return (
    datasets.find((d) => d.id === id) ?? datasets.find((d) => d.is_active) ?? datasets[0] ?? null
  );
}
