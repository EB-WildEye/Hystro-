import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string;
  role: "admin" | "reviewer" | "tester";
  reviewer_slot: number | null;
};

// Data Access Layer: the single place that verifies who is signed in.
// getClaims() validates the JWT signature, so the result can be trusted.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, reviewer_slot")
    .eq("id", userId)
    .maybeSingle();
  return (profile as Profile | null) ?? null;
});

// Reviewers and testers rate. A tester's ratings stay out of the study data
// (it is read by reviewer slot); the admin sees them on the testers page.
export async function requireRater(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "reviewer" && profile.role !== "tester") redirect("/admin");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/review");
  return profile;
}
