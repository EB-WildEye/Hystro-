export const RATING_VALUES = ["resident", "specialist"] as const;
export type Rating = (typeof RATING_VALUES)[number];

export const RATING_LABEL: Record<Rating, string> = {
  resident: "מתמחה",
  specialist: "מומחה",
};

export function isRating(value: unknown): value is Rating {
  return typeof value === "string" && (RATING_VALUES as readonly string[]).includes(value);
}
