"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/dal";
import { isAllowed, isRating, isStage, type Stage } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

function parseCaseId(formData: FormData): number {
  const id = Number(formData.get("caseId"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid case id");
  return id;
}

function parseStage(formData: FormData): Stage {
  const stage = formData.get("stage");
  if (!isStage(stage)) throw new Error("Invalid stage");
  return stage;
}

// Saves where the reviewer is in this case's dataset (case and stage), and
// returns the dataset.
async function rememberPosition(caseId: number, stage: Stage, reviewerId: string): Promise<number> {
  const supabase = await createClient();
  const { data: c, error } = await supabase.from("cases").select("sort_order, dataset_id").eq("id", caseId).single();
  if (error || !c) throw new Error("Case not found");
  const { error: stateError } = await supabase.from("reviewer_state").upsert({
    reviewer_id: reviewerId,
    dataset_id: c.dataset_id,
    last_sort_order: c.sort_order,
    last_stage: stage,
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
  const stage = parseStage(formData);
  const rating = formData.get("rating");
  if (!isRating(rating) || !isAllowed(stage, rating)) throw new Error("Invalid rating");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ratings")
    .upsert({ case_id: caseId, reviewer_id: profile.id, stage, rating }, { onConflict: "case_id,reviewer_id,stage" });
  if (error) throw new Error(error.message);

  back(formData, await rememberPosition(caseId, stage, profile.id));
}

// "Next": move on in the dataset without rating this card.
export async function skipCase(formData: FormData) {
  const profile = await requireReviewer();
  const datasetId = await rememberPosition(parseCaseId(formData), parseStage(formData), profile.id);
  redirect(`/review?dataset=${datasetId}`);
}

// Removes one of the reviewer's own ratings; that card goes back to their
// queue. RLS only lets a reviewer delete their own rows, and the removal is
// logged in rating_events by a database trigger.
export async function removeRating(formData: FormData) {
  const profile = await requireReviewer();
  const caseId = parseCaseId(formData);
  const stage = parseStage(formData);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("ratings")
    .delete({ count: "exact" })
    .eq("case_id", caseId)
    .eq("reviewer_id", profile.id)
    .eq("stage", stage);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error("Rating not removed");

  redirect(formData.get("returnTo") === "case" ? `/review?case=${caseId}&stage=${stage}` : "/review/mine");
}
