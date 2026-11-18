// Each case is rated twice per reviewer: once for entering the uterine
// cavity, once for the operative procedure. The operative question can also
// be "not applicable" when no operative step is planned.

export const STAGES = ["entry", "operative"] as const;
export type Stage = (typeof STAGES)[number];

export const RATING_VALUES = ["junior", "senior", "not_applicable"] as const;
export type Rating = (typeof RATING_VALUES)[number];

export const RATING_LABEL: Record<Rating, string> = {
  junior: "מומחה צעיר",
  senior: "מומחה ותיק",
  not_applicable: "לא רלוונטי",
};

export const STAGE_TITLE: Record<Stage, string> = {
  entry: "כניסה לחלל הרחם (היסטרוסקופיה אבחנתית)",
  operative: "ביצוע הפעולה הניתוחית (היסטרוסקופיה ניתוחית)",
};

export const STAGE_SHORT: Record<Stage, string> = {
  entry: "כניסה",
  operative: "פעולה",
};

export const STAGE_QUESTION: Record<Stage, string> = {
  entry: "איזה מומחה מתאים לביצוע הכניסה לחלל הרחם?",
  operative: "איזה מומחה מתאים לביצוע הפעולה הניתוחית?",
};

// The answers each stage offers, in display order.
export const STAGE_OPTIONS: Record<Stage, readonly Rating[]> = {
  entry: ["junior", "senior"],
  operative: ["junior", "senior", "not_applicable"],
};

export function isRating(value: unknown): value is Rating {
  return typeof value === "string" && (RATING_VALUES as readonly string[]).includes(value);
}

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function isAllowed(stage: Stage, rating: Rating): boolean {
  return STAGE_OPTIONS[stage].includes(rating);
}
