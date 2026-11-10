import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { AnalyticsView } from "@/components/analytics-view";
import { getProfile } from "@/lib/dal";
import { loadAdminData } from "@/lib/admin-data";
import { ADMIN_NAV } from "./nav";

async function Dashboard() {
  const { analytics, generatedAt } = await loadAdminData();
  const profile = await getProfile();
  return (
    <>
      <Header title="ניהול - דירוג היסטרוסקופיה" nav={ADMIN_NAV} userName={profile?.display_name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">דשבורד</h1>
            <p className="text-sm text-muted" dir="rtl">
              עודכן {generatedAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/admin/export" className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">
              ייצוא CSV
            </a>
            <Link href="/admin/report" className="rounded-lg border border-accent px-4 py-2 font-semibold text-accent">
              דוח PDF
            </Link>
            <Link href="/admin/cases?filter=ambivalent" className="rounded-lg border border-line px-4 py-2 font-semibold">
              קבלות אמביוולנטיות
            </Link>
          </div>
        </div>
        <AnalyticsView a={analytics} />
      </main>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <Dashboard />
    </Suspense>
  );
}
