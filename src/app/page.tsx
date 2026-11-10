import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";

async function RouteByRole() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "admin" ? "/admin" : "/review");
  return null;
}

export default function Home() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <RouteByRole />
    </Suspense>
  );
}
