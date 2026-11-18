import { RATING_LABEL, type Rating } from "@/lib/labels";

const STYLE: Record<Rating, string> = {
  junior: "bg-junior-soft text-junior",
  senior: "bg-senior-soft text-senior",
  not_applicable: "bg-line text-muted",
};

export function RatingBadge({ value }: { value: Rating | null }) {
  if (!value) return <span className="text-muted">-</span>;
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${STYLE[value]}`}>
      {RATING_LABEL[value]}
    </span>
  );
}
