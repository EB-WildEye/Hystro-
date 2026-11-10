import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { RatingBadge } from "@/components/rating-badge";
import { getProfile } from "@/lib/dal";
import { loadAdminData } from "@/lib/admin-data";
import type { CaseSummary } from "@/lib/stats";
import { ADMIN_NAV } from "../nav";

const FILTERS = {
  all: { label: "הכל", test: () => true },
  ambivalent: { label: "אמביוולנטיות", test: (s: CaseSummary) => s.ambivalent },
  incomplete: { label: "לא הושלמו", test: (s: CaseSummary) => s.status !== "complete" },
  unrated: { label: "טרם דורגו", test: (s: CaseSummary) => s.status === "unrated" },
  complete: { label: "הושלמו", test: (s: CaseSummary) => s.status === "complete" },
} as const;
type FilterKey = keyof typeof FILTERS;

async function CasesTable({ searchParams }: { searchParams: PageProps<"/admin/cases">["searchParams"] }) {
  const { summaries, reviewers } = await loadAdminData();
  const profile = await getProfile();
  const raw = (await searchParams).filter;
  const filter: FilterKey = typeof raw === "string" && raw in FILTERS ? (raw as FilterKey) : "all";
  const rows = summaries.filter(FILTERS[filter].test);

  return (
    <>
      <Header title="ניהול - דירוג היסטרוסקופיה" nav={ADMIN_NAV} userName={profile?.display_name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">קבלות ({rows.length})</h1>
          <a href="/admin/export" className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">
            ייצוא CSV
          </a>
        </div>
        <nav className="mb-4 flex flex-wrap gap-2 text-sm">
          {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
            <Link
              key={key}
              href={`/admin/cases?filter=${key}`}
              className={`rounded-full border px-3 py-1 ${key === filter ? "border-accent bg-accent-soft text-accent" : "border-line"}`}
            >
              {FILTERS[key].label} ({summaries.filter(FILTERS[key].test).length})
            </Link>
          ))}
        </nav>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-bg text-muted">
              <tr>
                <th className="px-3 py-2 text-start font-medium">מטופלת</th>
                {reviewers.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-start font-medium">{r.display_name}</th>
                ))}
                <th className="px-3 py-2 text-start font-medium">הכרעת רוב</th>
                <th className="px-3 py-2 text-start font-medium">קבלה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.case.id} className={s.ambivalent ? "bg-warn-soft/60" : undefined}>
                  <td className="px-3 py-2 align-top font-semibold" dir="ltr">{s.case.case_number}</td>
                  {reviewers.map((r) => (
                    <td key={r.id} className="px-3 py-2 align-top">
                      <RatingBadge value={s.bySlot[r.reviewer_slot - 1]} />
                    </td>
                  ))}
                  <td className="px-3 py-2 align-top"><RatingBadge value={s.majority} /></td>
                  <td className="px-3 py-2 align-top">
                    <details>
                      <summary className="cursor-pointer text-accent">הצגה</summary>
                      <div className="mt-2 max-w-xl">
                        <p className="clinical-text">{s.case.admission_text}</p>
                        {s.case.ultrasound_text && (
                          <p className="clinical-text mt-2 border-t border-line pt-2 text-muted">{s.case.ultrasound_text}</p>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-6 text-center text-muted">אין קבלות בסינון הזה.</p>}
        </div>
      </main>
    </>
  );
}

export default function AdminCasesPage(props: PageProps<"/admin/cases">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <CasesTable searchParams={props.searchParams} />
    </Suspense>
  );
}
