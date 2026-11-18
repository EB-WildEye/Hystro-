// unit names what is counted, e.g. "דירוגים" (ratings: two per case).
export function ProgressBar({ done, total, label, unit }: { done: number; total: number; label: string; unit?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <span className="tabular-nums">
        {done} מתוך {total}
        {unit && ` ${unit}`}
      </span>
    </div>
  );
}
