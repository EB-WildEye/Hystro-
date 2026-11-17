import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/dal";
import { listDatasets } from "@/lib/datasets";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_NAV } from "../nav";
import { setDatasetActive } from "./actions";
import { UploadForm } from "./upload-form";

async function Files() {
  const profile = await requireAdmin();
  const datasets = await listDatasets();
  const supabase = await createClient();
  const counts = await Promise.all(
    datasets.map(async (d) => {
      const { count, error } = await supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("dataset_id", d.id);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
  );

  return (
    <>
      <Header title="ניהול - דירוג היסטרוסקופיה" nav={ADMIN_NAV} userName={profile.display_name} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_24rem]">
        <section>
          <h1 className="text-2xl font-bold">קבצים</h1>
          <p className="mt-1 text-sm text-muted">
            הסוקרים רואים רק קבצים פתוחים, ובוחרים על איזה מהם לעבוד. בקובץ סגור הדירוגים נשמרים ולא ניתנים לשינוי.
          </p>
          {datasets.length === 0 ? (
            <p className="mt-6 text-muted">עוד לא הועלו קבצים.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-2xl bg-surface shadow-card">
              {datasets.map((d, i) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin?dataset=${d.id}`} className="font-semibold hover:underline">
                      {d.name}
                    </Link>
                    <p className="text-sm text-muted">
                      {counts[i]} קבלות · הועלה {new Date(d.created_at).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                      d.is_active ? "bg-resident-soft text-resident" : "bg-line text-muted"
                    }`}
                  >
                    {d.is_active ? "פתוח" : "סגור"}
                  </span>
                  <form action={setDatasetActive}>
                    <input type="hidden" name="datasetId" value={d.id} />
                    <input type="hidden" name="active" value={String(!d.is_active)} />
                    <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-bg">
                      {d.is_active ? "סגירה לדירוג" : "פתיחה לדירוג"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="h-fit rounded-2xl bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-lg font-bold">העלאת קובץ חדש</h2>
          <UploadForm />
        </section>
      </main>
    </>
  );
}

export default function FilesPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <Files />
    </Suspense>
  );
}
