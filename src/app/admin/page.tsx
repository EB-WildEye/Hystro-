import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { AnalyticsView } from "@/components/analytics-view";
import { DatasetTabs, NoDatasets } from "@/components/dataset-tabs";
import { adminContext, loadAdminData } from "@/lib/admin-data";
import { ADMIN_NAV } from "./nav";

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
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
  const { analytics, generatedAt } = await loadAdminData(dataset.id);
  const q = `?dataset=${dataset.id}`;
  return (
    <>
      {header}
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <DatasetTabs datasets={datasets} current={dataset} basePath="/admin" />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">דשבורד - {dataset.name}</h1>
            <p className="text-sm text-muted">
              {dataset.is_active ? "פתוח לדירוג" : "סגור לדירוג"} · עודכן{" "}
              {generatedAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/export${q}`} className="rounded-lg bg-accent px-4 py-2 font-semibold text-on-accent">
              ייצוא לאקסל
            </a>
            <Link href={`/admin/report${q}`} className="rounded-lg border border-accent px-4 py-2 font-semibold text-accent">
              דוח PDF
            </Link>
            <Link href={`/admin/cases${q}&filter=ambivalent`} className="rounded-lg border border-line px-4 py-2 font-semibold">
              קבלות אמביוולנטיות
            </Link>
          </div>
        </div>
        <AnalyticsView a={analytics} />
      </main>
    </>
  );
}

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}
