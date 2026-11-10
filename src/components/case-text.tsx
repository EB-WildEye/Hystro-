export function CaseText({
  admission,
  ultrasound,
}: {
  admission: string;
  ultrasound: string | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold text-muted">קבלה במיון</h2>
        <p className="clinical-text">{admission}</p>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold text-muted">ממצאי אולטרסאונד</h2>
        {ultrasound?.trim() ? (
          <p className="clinical-text">{ultrasound}</p>
        ) : (
          <p className="text-muted">אין ממצאי אולטרסאונד</p>
        )}
      </section>
    </div>
  );
}
