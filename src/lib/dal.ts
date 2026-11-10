import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string;
  role: "admin" | "reviewer";
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

export async function requireReviewer(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "reviewer") redirect("/admin");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/review");
  return profile;
}
