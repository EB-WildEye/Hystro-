import { RATING_LABEL, STAGE_TITLE, STAGES, type Rating } from "@/lib/labels";
import { kappaBand, type Analytics, type StageAnalytics } from "@/lib/stats";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");
const fmtK = (k: number | null) => (k === null ? "-" : k.toFixed(3));

const DOT: Record<Rating, string> = { junior: "bg-junior", senior: "bg-senior", not_applicable: "bg-muted" };

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="avoid-break rounded-xl border border-line bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}

function SplitBar({ counts, options }: { counts: Record<Rating, number>; options: readonly Rating[] }) {
  const total = options.reduce((n, o) => n + counts[o], 0);
  if (!total) return <div className="h-3 rounded-full bg-line" />;
  return (
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {options.map((o) => (
        <div key={o} className={DOT[o]} style={{ width: `${(counts[o] / total) * 100}%` }} />
      ))}
    </div>
  );
}

function StageSection({ s, totalCases }: { s: StageAnalytics; totalCases: number }) {
  return (
    <section className="avoid-break flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-lg font-bold">{STAGE_TITLE[s.stage]}</h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="דורגו ע״י כל המעריכים" value={s.complete} note={pct(s.complete, totalCases)} />
        <Tile label="חילוקי דעות" value={s.ambivalent} note="לפחות שני דירוגים שאינם זהים" />
        <Tile label="הסכמה מלאה" value={s.unanimous} note={`מתוך ${s.complete} שדורגו במלואן`} />
        <Tile label="Fleiss' kappa" value={fmtK(s.fleiss)} note={`${kappaBand(s.fleiss)} · n=${s.fleissN}`} />
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-muted">הכרעת רוב:</span>
        {s.options.map((o) => (
          <span key={o} className="flex items-center gap-1.5">
            <span className={`inline-block size-2.5 rounded-full ${DOT[o]}`} /> {RATING_LABEL[o]}{" "}
            <span className="font-semibold tabular-nums">{s.majority[o]}</span>
          </span>
        ))}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 text-start font-medium">מעריך</th>
              <th className="py-2 text-start font-medium">דורגו</th>
              <th className="py-2 text-start font-medium">נותרו</th>
              {s.options.map((o) => (
                <th key={o} className="py-2 text-start font-medium">
                  {RATING_LABEL[o]}
                </th>
              ))}
              <th className="w-1/4 py-2 text-start font-medium">התפלגות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {s.perReviewer.map((r) => (
              <tr key={r.reviewer.id}>
                <td className="py-2">
                  {r.reviewer.reviewer_slot}. {r.reviewer.display_name}
                </td>
                <td className="py-2">
                  {r.rated} ({pct(r.rated, totalCases)})
                </td>
                <td className="py-2">{r.remaining}</td>
                {s.options.map((o) => (
                  <td key={o} className="py-2">
                    {r.counts[o]} ({pct(r.counts[o], r.rated)})
                  </td>
                ))}
                <td className="py-2">
                  <SplitBar counts={r.counts} options={s.options} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <h3 className="mb-2 font-semibold">הסכמה בין זוגות מעריכים (Cohen&apos;s kappa)</h3>
        <table className="w-full text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 text-start font-medium">זוג</th>
              <th className="py-2 text-start font-medium">קבלות משותפות</th>
              <th className="py-2 text-start font-medium">אחוז הסכמה</th>
              <th className="py-2 text-start font-medium">kappa</th>
              <th className="py-2 text-start font-medium">פרשנות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {s.pairwise.map((p) => (
              <tr key={`${p.a.id}-${p.b.id}`}>
                <td className="py-2">
                  {p.a.display_name} - {p.b.display_name}
                </td>
                <td className="py-2">{p.n}</td>
                <td className="py-2">{p.agreement === null ? "-" : `${Math.round(p.agreement * 100)}%`}</td>
                <td className="py-2">{fmtK(p.kappa)}</td>
                <td className="py-2">{kappaBand(p.kappa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AnalyticsView({ a }: { a: Analytics }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="סה״כ קבלות" value={a.totalCases} note="לכל קבלה שני דירוגים" />
        <Tile label="דורגו במלואן" value={a.casesComplete} note="שני השלבים, כל המעריכים" />
        <Tile label="טרם דורגו" value={a.casesUnrated} />
        <Tile label="עם חילוקי דעות" value={a.casesDisputed} note="בשלב אחד לפחות" />
      </section>
      {STAGES.map((stage) => (
        <StageSection key={stage} s={a.stages[stage]} totalCases={a.totalCases} />
      ))}
      <p className="text-xs text-muted">
        kappa מחושב לכל שלב בנפרד, עם אפשרויות התשובה של אותו שלב כקטגוריות (בשלב הפעולה הניתוחית גם &quot;לא רלוונטי&quot;).
        Fleiss&apos; kappa מחושב רק על קבלות שדורגו ע״י כל המעריכים. פרשנות לפי Landis &amp; Koch, 1977.
      </p>
    </div>
  );
}
