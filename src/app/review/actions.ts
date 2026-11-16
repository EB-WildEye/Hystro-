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

async function rememberPosition(caseId: number, reviewerId: string) {
  const supabase = await createClient();
  const { data: c, error } = await supabase.from("cases").select("sort_order").eq("id", caseId).single();
  if (error || !c) throw new Error("Case not found");
  const { error: stateError } = await supabase
    .from("reviewer_state")
    .upsert({ reviewer_id: reviewerId, last_sort_order: c.sort_order, updated_at: new Date().toISOString() });
  if (stateError) throw new Error(stateError.message);
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

  await rememberPosition(caseId, profile.id);
  redirect(formData.get("returnTo") === "mine" ? "/review/mine" : "/review");
}

export async function skipCase(formData: FormData) {
  const profile = await requireReviewer();
  await rememberPosition(parseCaseId(formData), profile.id);
  redirect("/review");
}

// Removes the reviewer's own rating; the case goes back to their queue.
// RLS only lets a reviewer delete their own rows, and the removal is logged
// in rating_events by a database trigger.
export async function removeRating(formData: FormData) {
  const profile = await requireReviewer();
  const caseId = parseCaseId(formData);

  const supabase = await createClient();
  const { error } = await supabase.from("ratings").delete().eq("case_id", caseId).eq("reviewer_id", profile.id);
  if (error) throw new Error(error.message);

  redirect("/review/mine");
}
