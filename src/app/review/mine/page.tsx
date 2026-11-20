import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { RatingBadge } from "@/components/rating-badge";
import { requireRater } from "@/lib/dal";
import { listDatasets } from "@/lib/datasets";
import { isRating, isStage, STAGE_SHORT, STAGES, type Rating, type Stage } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_NAV } from "../nav";
import { RemoveRating } from "../remove-rating";

type Row = { id: number; caseNumber: string; sortOrder: number; ratings: Partial<Record<Stage, Rating>> };

function StageCell({ row, stage }: { row: Row; stage: Stage }) {
  const rating = row.ratings[stage] ?? null;
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="w-12 text-sm text-muted">{STAGE_SHORT[stage]}</span>
      {rating ? <RatingBadge value={rating} /> : <span className="text-sm text-muted">לא דורג</span>}
      <span className="flex items-center">
        <Link
          href={`/review?case=${row.id}&stage=${stage}&from=mine`}
          aria-label={`${rating ? "עריכת" : "דירוג"} ${STAGE_SHORT[stage]} של מטופלת ${row.caseNumber}`}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          {rating ? "עריכה" : "דירוג"}
        </Link>
        {rating && <RemoveRating caseId={row.id} caseNumber={row.caseNumber} stage={stage} />}
      </span>
    </div>
  );
}

async function MyRatings() {
  const profile = await requireRater();
  const supabase = await createClient();
  const datasets = await listDatasets();
  // RLS returns only this reviewer's own ratings.
  const { data, error } = await supabase
    .from("ratings")
    .select("stage, rating, cases!inner(id, case_number, sort_order, dataset_id)")
    .eq("reviewer_id", profile.id)
    .limit(20000);
  if (error) throw new Error(error.message);

  // One row per case, with the ratings it has for each stage.
  const byDataset = new Map<number, Map<number, Row>>();
  for (const r of data ?? []) {
    const c = r.cases as unknown as { id: number; case_number: string; sort_order: number; dataset_id: number };
    if (!isStage(r.stage) || !isRating(r.rating)) continue;
    const rows = byDataset.get(c.dataset_id) ?? new Map<number, Row>();
    const row = rows.get(c.id) ?? { id: c.id, caseNumber: c.case_number, sortOrder: c.sort_order, ratings: {} };
    row.ratings[r.stage] = r.rating;
    rows.set(c.id, row);
    byDataset.set(c.dataset_id, rows);
  }
  const groups = datasets
    .map((d) => ({ dataset: d, rows: [...(byDataset.get(d.id)?.values() ?? [])].sort((a, b) => a.sortOrder - b.sortOrder) }))
    .filter((g) => g.rows.length > 0);
  const total = groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + Object.keys(r.ratings).length, 0), 0);

  return (
    <>
      <Header title="דירוג היסטרוסקופיה" nav={REVIEW_NAV} userName={profile.display_name} tester={profile.role === "tester"} />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-xl font-bold">הדירוגים שלי ({total})</h1>
        <p className="mt-1 text-sm text-muted">
          לכל קבלה שני דירוגים: כניסה לחלל הרחם ופעולה ניתוחית. עריכה פותחת את הכרטיס לדירוג מחדש. הסרה מוחקת את הדירוג
          ומחזירה את הכרטיס לתור.
        </p>
        {groups.length === 0 && <p className="mt-8 text-muted">עוד לא דירגת קבלות.</p>}
        {groups.map(({ dataset, rows }) => (
          <section key={dataset.id} className="mt-6">
            {datasets.length > 1 && (
              <h2 className="mb-2 font-semibold">
                {dataset.name} <span className="font-normal text-muted">({rows.length} קבלות)</span>
              </h2>
            )}
            <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-28 shrink-0 font-semibold">
                    מטופלת <span dir="ltr">{r.caseNumber}</span>
                  </span>
                  {STAGES.map((stage) => (
                    <StageCell key={stage} row={r} stage={stage} />
                  ))}
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
