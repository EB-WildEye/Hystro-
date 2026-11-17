"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/dal";
import { isRating } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

function parseCaseId(formData: FormData): number {
  const id = Number(formData.get("caseId"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid case id");
  return id;
}

// Saves where the reviewer is in this case's dataset, and returns the dataset.
async function rememberPosition(caseId: number, reviewerId: string): Promise<number> {
  const supabase = await createClient();
  const { data: c, error } = await supabase.from("cases").select("sort_order, dataset_id").eq("id", caseId).single();
  if (error || !c) throw new Error("Case not found");
  const { error: stateError } = await supabase.from("reviewer_state").upsert({
    reviewer_id: reviewerId,
    dataset_id: c.dataset_id,
    last_sort_order: c.sort_order,
    updated_at: new Date().toISOString(),
  });
  if (stateError) throw new Error(stateError.message);
  return c.dataset_id;
}

function back(formData: FormData, datasetId: number): never {
  redirect(formData.get("returnTo") === "mine" ? "/review/mine" : `/review?dataset=${datasetId}`);
}

export async function rateCase(formData: FormData) {
  const profile = await requireReviewer();
  const caseId = parseCaseId(formData);
  const rating = formData.get("rating");
  if (!isRating(rating)) throw new Error("Invalid rating");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ratings")
    .upsert({ case_id: caseId, reviewer_id: profile.id, rating }, { onConflict: "case_id,reviewer_id" });
  if (error) throw new Error(error.message);

  back(formData, await rememberPosition(caseId, profile.id));
}

// "Next": move on in the dataset without rating.
export async function skipCase(formData: FormData) {
  const profile = await requireReviewer();
  const datasetId = await rememberPosition(parseCaseId(formData), profile.id);
  redirect(`/review?dataset=${datasetId}`);
}

// Removes the reviewer's own rating; the case goes back to their queue.
// RLS only lets a reviewer delete their own rows, and the removal is logged
// in rating_events by a database trigger.
export async function removeRating(formData: FormData) {
  const profile = await requireReviewer();
  const caseId = parseCaseId(formData);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("ratings")
    .delete({ count: "exact" })
    .eq("case_id", caseId)
    .eq("reviewer_id", profile.id);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error("Rating not removed");

  redirect(formData.get("returnTo") === "case" ? `/review?case=${caseId}` : "/review/mine");
}
