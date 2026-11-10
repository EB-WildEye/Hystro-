import { RATING_LABEL, type Rating } from "@/lib/labels";

export function RatingBadge({ value }: { value: Rating | null }) {
  if (!value) return <span className="text-muted">-</span>;
  const cls =
    value === "resident" ? "bg-resident-soft text-resident" : "bg-specialist-soft text-specialist";
  return <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${cls}`}>{RATING_LABEL[value]}</span>;
}
