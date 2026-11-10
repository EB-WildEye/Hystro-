import { RATING_LABEL } from "@/lib/labels";
import { kappaBand, type Analytics } from "@/lib/stats";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");
const fmtK = (k: number | null) => (k === null ? "-" : k.toFixed(3));

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="avoid-break rounded-xl border border-line bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}

function SplitBar({ resident, specialist }: { resident: number; specialist: number }) {
  const total = resident + specialist;
  if (!total) return <div className="h-3 rounded-full bg-line" />;
  return (
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      <div className="bg-resident" style={{ width: `${(resident / total) * 100}%` }} />
      <div className="bg-specialist" style={{ width: `${(specialist / total) * 100}%` }} />
    </div>
  );
}

export function AnalyticsView({ a }: { a: Analytics }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="סה״כ קבלות" value={a.totalCases} />
        <Tile label="דורגו ע״י כל המעריכים" value={a.complete} note={pct(a.complete, a.totalCases)} />
        <Tile label="דירוג חלקי" value={a.partial} />
        <Tile label="טרם דורגו" value={a.unrated} />
        <Tile label="אמביוולנטיות" value={a.ambivalent} note="לפחות שני דירוגים שאינם זהים" />
        <Tile label="הסכמה מלאה" value={a.unanimous} note={`מתוך ${a.complete} שדורגו במלואן`} />
        <Tile label="Fleiss' kappa" value={fmtK(a.fleiss)} note={`${kappaBand(a.fleiss)} · n=${a.fleissN}`} />
        <Tile
          label="הכרעת רוב"
          value={`${a.majority.resident} / ${a.majority.specialist}`}
          note={`${RATING_LABEL.resident} / ${RATING_LABEL.specialist}`}
        />
      </section>

      <section className="avoid-break rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-1 font-bold">התקדמות והתפלגות לפי מעריך</h2>
        <p className="mb-4 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-resident" /> {RATING_LABEL.resident}</span>
          <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-specialist" /> {RATING_LABEL.specialist}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr className="text-start">
                <th className="py-2 text-start font-medium">מעריך</th>
                <th className="py-2 text-start font-medium">דורגו</th>
                <th className="py-2 text-start font-medium">נותרו</th>
                <th className="py-2 text-start font-medium">{RATING_LABEL.resident}</th>
                <th className="py-2 text-start font-medium">{RATING_LABEL.specialist}</th>
                <th className="w-1/3 py-2 text-start font-medium">התפלגות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {a.perReviewer.map((r) => (
                <tr key={r.reviewer.id}>
                  <td className="py-2">{r.reviewer.reviewer_slot}. {r.reviewer.display_name}</td>
                  <td className="py-2">{r.rated} ({pct(r.rated, a.totalCases)})</td>
                  <td className="py-2">{r.remaining}</td>
                  <td className="py-2">{r.resident} ({pct(r.resident, r.rated)})</td>
                  <td className="py-2">{r.specialist} ({pct(r.specialist, r.rated)})</td>
                  <td className="py-2"><SplitBar resident={r.resident} specialist={r.specialist} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="avoid-break rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-4 font-bold">הסכמה בין זוגות מעריכים (Cohen&apos;s kappa)</h2>
        <div className="overflow-x-auto">
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
              {a.pairwise.map((p) => (
                <tr key={`${p.a.id}-${p.b.id}`}>
                  <td className="py-2">{p.a.display_name} - {p.b.display_name}</td>
                  <td className="py-2">{p.n}</td>
                  <td className="py-2">{p.agreement === null ? "-" : `${Math.round(p.agreement * 100)}%`}</td>
                  <td className="py-2">{fmtK(p.kappa)}</td>
                  <td className="py-2">{kappaBand(p.kappa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">
          Fleiss&apos; kappa מחושב רק על קבלות שדורגו ע״י שלושת המעריכים. פרשנות לפי Landis &amp; Koch, 1977.
        </p>
      </section>
    </div>
  );
}
