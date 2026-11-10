import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { RatingBadge } from "@/components/rating-badge";
import { requireReviewer } from "@/lib/dal";
import { isRating } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/review", label: "דירוג" },
  { href: "/review/mine", label: "הדירוגים שלי" },
];

async function MyRatings() {
  const profile = await requireReviewer();
  const supabase = await createClient();
  // RLS returns only this reviewer's rows; the filter is explicit as well.
  const { data, error } = await supabase
    .from("ratings")
    .select("rating, updated_at, cases!inner(id, case_number, sort_order)")
    .eq("reviewer_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => {
    const c = r.cases as unknown as { id: number; case_number: string };
    return { id: c.id, caseNumber: c.case_number, rating: isRating(r.rating) ? r.rating : null, updatedAt: r.updated_at };
  });

  return (
    <>
      <Header title="דירוג היסטרוסקופיה" nav={NAV} userName={profile.display_name} />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-xl font-bold">הדירוגים שלי ({rows.length})</h1>
        <p className="mt-1 text-sm text-muted">לחיצה על שורה פותחת את הקבלה ומאפשרת לשנות את הדירוג.</p>
        {rows.length === 0 ? (
          <p className="mt-8 text-muted">עוד לא דירגת קבלות.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/review?case=${r.id}&from=mine`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-bg"
                >
                  <span>
                    מטופלת <span dir="ltr">{r.caseNumber}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="text-xs text-muted" dir="ltr">
                      {new Date(r.updatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
                    </span>
                    <RatingBadge value={r.rating} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

export default function MyRatingsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <MyRatings />
    </Suspense>
  );
}
