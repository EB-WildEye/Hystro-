import Link from "next/link";
import type { Dataset } from "@/lib/datasets";

// Switches the admin page between datasets. `extra` keeps other query
// parameters, such as the cases filter.
export function DatasetTabs({
  datasets,
  current,
  basePath,
  extra = "",
}: {
  datasets: Dataset[];
  current: Dataset;
  basePath: string;
  extra?: string;
}) {
  if (datasets.length < 2) return null;
  return (
    <nav aria-label="בחירת קובץ" className="no-print mb-5 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">קובץ:</span>
      {datasets.map((d) => (
        <Link
          key={d.id}
          href={`${basePath}?dataset=${d.id}${extra}`}
          aria-current={d.id === current.id ? "page" : undefined}
          className={`rounded-full border px-3 py-1 ${
            d.id === current.id ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line hover:bg-surface"
          }`}
        >
          {d.name}
        </Link>
      ))}
    </nav>
  );
}

export function NoDatasets() {
  return (
    <div className="rounded-2xl bg-surface p-8 text-center shadow-card">
      <h2 className="text-lg font-bold">עוד אין קבצים במערכת</h2>
      <p className="mt-2 text-muted">כדי להתחיל, מעלים קובץ קבלות בעמוד הקבצים.</p>
      <Link href="/admin/files" className="mt-4 inline-block rounded-full bg-accent px-5 py-2 font-semibold text-on-accent">
        לעמוד הקבצים
      </Link>
    </div>
  );
}
