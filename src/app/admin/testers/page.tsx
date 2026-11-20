import { Suspense } from "react";
import { Header } from "@/components/header";
import { RatingBadge } from "@/components/rating-badge";
import { DatasetTabs, NoDatasets } from "@/components/dataset-tabs";
import { adminContext, loadTesterData } from "@/lib/admin-data";
import { STAGE_SHORT, STAGES } from "@/lib/labels";
import { ADMIN_NAV } from "../nav";

// Ratings by test accounts. They are kept out of the dashboard, the cases
// table, the report and the Excel export, which hold the study data only.
async function Testers({ searchParams }: { searchParams: PageProps<"/admin/testers">["searchParams"] }) {
  const { profile, datasets, dataset } = await adminContext((await searchParams).dataset);
  const header = <Header title="ניהול - דירוג היסטרוסקופיה" nav={ADMIN_NAV} userName={profile.display_name} />;
  if (!dataset) {
    return (
      <>
        {header}
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          <NoDatasets />
        </main>
      </>
    );
  }
  const { testers, rows } = await loadTesterData(dataset.id);

  return (
    <>
      {header}
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <DatasetTabs datasets={datasets} current={dataset} basePath="/admin/testers" />
        <h1 className="text-xl font-bold">דירוגי בדיקה - {dataset.name}</h1>
        <p className="mt-1 mb-4 text-sm text-muted">
          דירוגים של חשבונות בדיקה. הם לא נכללים בדשבורד, בטבלת הקבלות, בדוח ובייצוא לאקסל.
        </p>
        {testers.length === 0 ? (
          <p className="text-muted">אין חשבונות בדיקה.</p>
        ) : rows.length === 0 ? (
          <p className="text-muted">חשבונות הבדיקה עוד לא דירגו קבלות בקובץ הזה.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-bg text-muted">
                <tr>
                  <th rowSpan={2} className="px-3 py-2 text-start align-bottom font-medium">
                    מטופלת
                  </th>
                  {testers.map((t) => (
                    <th key={t.id} colSpan={2} className="border-s border-line px-3 pt-2 text-start font-medium">
                      {t.display_name}
                    </th>
                  ))}
                </tr>
                <tr className="text-xs">
                  {testers.flatMap((t) =>
                    STAGES.map((stage) => (
                      <th
                        key={`${t.id}-${stage}`}
                        className={`px-3 pb-2 text-start font-normal ${stage === "entry" ? "border-s border-line" : ""}`}
                      >
                        {STAGE_SHORT[stage]}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.caseId}>
                    <td className="px-3 py-2 font-semibold" dir="ltr">
                      {r.caseNumber}
                    </td>
                    {testers.flatMap((t) =>
                      STAGES.map((stage) => (
                        <td
                          key={`${t.id}-${stage}`}
                          className={`px-3 py-2 ${stage === "entry" ? "border-s border-line" : ""}`}
                        >
                          <RatingBadge value={r.ratings.get(t.id)?.[stage] ?? null} />
                        </td>
                      )),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

export default function TestersPage(props: PageProps<"/admin/testers">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <Testers searchParams={props.searchParams} />
    </Suspense>
  );
}
