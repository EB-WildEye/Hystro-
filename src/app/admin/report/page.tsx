import { Suspense } from "react";
import { Header } from "@/components/header";
import { AnalyticsView } from "@/components/analytics-view";
import { RatingBadge } from "@/components/rating-badge";
import { getProfile } from "@/lib/dal";
import { loadAdminData } from "@/lib/admin-data";
import { ADMIN_NAV } from "../nav";
import { PrintButton } from "./print-button";

// Printable analytics report. "Download as PDF" opens the browser's print
// dialog with "Save as PDF"; the browser renders Hebrew RTL text correctly,
// which server-side PDF libraries do not reliably do.
async function Report() {
  const { analytics, summaries, reviewers, generatedAt } = await loadAdminData();
  const profile = await getProfile();
  const ambivalent = summaries.filter((s) => s.ambivalent);

  return (
    <>
      <Header title="ניהול - דירוג היסטרוסקופיה" nav={ADMIN_NAV} userName={profile?.display_name} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="no-print mb-6 flex items-center justify-between rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">בחלון ההדפסה יש לבחור &quot;שמירה כ-PDF&quot; כיעד.</p>
          <PrintButton />
        </div>

        <h1 className="text-2xl font-bold">דוח דירוג רמת מבצע להיסטרוסקופיה</h1>
        <p className="mb-6 text-sm text-muted">
          הופק {generatedAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
        </p>

        <AnalyticsView a={analytics} />

        <section className="print-break mt-8">
          <h2 className="mb-3 text-lg font-bold">קבלות אמביוולנטיות ({ambivalent.length})</h2>
          {ambivalent.length === 0 ? (
            <p className="text-muted">אין קבלות עם חילוקי דעות.</p>
          ) : (
            <table className="w-full rounded-xl border border-line bg-surface text-sm">
              <thead className="bg-bg text-muted">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">מטופלת</th>
                  {reviewers.map((r) => (
                    <th key={r.id} className="px-3 py-2 text-start font-medium">{r.display_name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ambivalent.map((s) => (
                  <tr key={s.case.id} className="avoid-break">
                    <td className="px-3 py-1.5" dir="ltr">{s.case.case_number}</td>
                    {reviewers.map((r) => (
                      <td key={r.id} className="px-3 py-1.5"><RatingBadge value={s.bySlot[r.reviewer_slot - 1]} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-8 border-t border-line pt-3 text-xs text-muted">
          מקורות: Cohen J. (1960) Educ Psychol Meas 20:37-46 · Fleiss J.L. (1971) Psychol Bull 76:378-382 ·
          Landis J.R., Koch G.G. (1977) Biometrics 33:159-174
        </footer>
      </main>
    </>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <Report />
    </Suspense>
  );
}
