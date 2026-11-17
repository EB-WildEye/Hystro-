import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { RatingBadge } from "@/components/rating-badge";
import { requireReviewer } from "@/lib/dal";
import { listDatasets } from "@/lib/datasets";
import { isRating, type Rating } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_NAV } from "../nav";
import { RemoveRating } from "../remove-rating";

type Row = { id: number; caseNumber: string; sortOrder: number; rating: Rating | null; updatedAt: string };

async function MyRatings() {
  const profile = await requireReviewer();
  const supabase = await createClient();
  const datasets = await listDatasets();
  // RLS returns only this reviewer's own ratings.
  const { data, error } = await supabase
    .from("ratings")
    .select("rating, updated_at, cases!inner(id, case_number, sort_order, dataset_id)")
    .eq("reviewer_id", profile.id)
    .limit(10000);
  if (error) throw new Error(error.message);

  const byDataset = new Map<number, Row[]>();
  for (const r of data ?? []) {
    const c = r.cases as unknown as { id: number; case_number: string; sort_order: number; dataset_id: number };
    const list = byDataset.get(c.dataset_id) ?? [];
    list.push({
      id: c.id,
      caseNumber: c.case_number,
      sortOrder: c.sort_order,
      rating: isRating(r.rating) ? r.rating : null,
      updatedAt: r.updated_at,
    });
    byDataset.set(c.dataset_id, list);
  }
  const groups = datasets
    .map((d) => ({ dataset: d, rows: (byDataset.get(d.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder) }))
    .filter((g) => g.rows.length > 0);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <>
      <Header title="דירוג היסטרוסקופיה" nav={REVIEW_NAV} userName={profile.display_name} />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-xl font-bold">הדירוגים שלי ({total})</h1>
        <p className="mt-1 text-sm text-muted">
          עריכה פותחת את הקבלה לדירוג מחדש. הסרה מוחקת את הדירוג ומחזירה את הקבלה לתור.
        </p>
        {groups.length === 0 && <p className="mt-8 text-muted">עוד לא דירגת קבלות.</p>}
        {groups.map(({ dataset, rows }) => (
          <section key={dataset.id} className="mt-6">
            {groups.length > 1 || datasets.length > 1 ? (
              <h2 className="mb-2 font-semibold">
                {dataset.name} <span className="font-normal text-muted">({rows.length})</span>
              </h2>
            ) : null}
            <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className="flex-1">
                    מטופלת <span dir="ltr">{r.caseNumber}</span>
                  </span>
                  <span className="hidden text-xs text-muted sm:inline" dir="ltr">
                    {new Date(r.updatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
                  </span>
                  <RatingBadge value={r.rating} />
                  <span className="flex items-center">
                    <Link
                      href={`/review?case=${r.id}&from=mine`}
                      aria-label={`עריכת הדירוג של מטופלת ${r.caseNumber}`}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft"
                    >
                      עריכה
                    </Link>
                    <RemoveRating caseId={r.id} caseNumber={r.caseNumber} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
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
