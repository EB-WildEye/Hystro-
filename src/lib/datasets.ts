import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Dataset = { id: number; name: string; created_at: string };

// All datasets, newest first. Reviewers and the admin see the same list.
export async function listDatasets(): Promise<Dataset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("datasets")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Dataset[];
}

export function parseId(value: unknown): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// The dataset named in the URL, otherwise the newest one.
export function chooseDataset(datasets: Dataset[], requested: unknown): Dataset | null {
  const id = parseId(requested);
  return datasets.find((d) => d.id === id) ?? datasets[0] ?? null;
}
