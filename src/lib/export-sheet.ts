import type { CellObject } from "write-excel-file/node";
import { RATING_LABEL, STAGE_SHORT, STAGES, type Rating } from "./labels.ts";
import type { CaseSummary, Reviewer } from "./stats.ts";

// Builds the admin export: one row per case with every reviewer's rating for
// each stage (entry, operative), the consensus columns per stage, the text the reviewers saw, and all annotation
// columns from the source spreadsheet in their original order.
// Pure data, so it is unit-tested directly (tests/export-sheet.test.ts).

export type Attribute = { name: string; value: string | null };

type Cell = CellObject;

const COLORS = {
  headerBg: "#3D4F8F",
  headerText: "#FFFFFF",
  line: "#DFE3EE",
  junior: "#0C7F73",
  juniorBg: "#DFF3EF",
  senior: "#7B3FA0",
  seniorBg: "#F1E6F7",
  notApplicable: "#5B6275",
  notApplicableBg: "#EEF0F4",
  disputedBg: "#FBF3DC",
};

const base: Cell = { alignVertical: "top", wrap: true, borderColor: COLORS.line, borderStyle: "thin" };

// Text cells are typed String so values such as "=..." are never formulas.
function text(value: string | null | undefined, extra: Partial<Cell> = {}): Cell {
  return { ...base, align: "right", type: String, value: value ?? undefined, ...extra };
}

function ratingCell(rating: Rating | null): Cell {
  if (!rating) return text(null, { align: "center" });
  const [textColor, backgroundColor] =
    rating === "junior"
      ? [COLORS.junior, COLORS.juniorBg]
      : rating === "senior"
        ? [COLORS.senior, COLORS.seniorBg]
        : [COLORS.notApplicable, COLORS.notApplicableBg];
  return text(RATING_LABEL[rating], { align: "center", fontWeight: "bold", textColor, backgroundColor });
}

function disputedCell(disputed: boolean): Cell {
  return text(disputed ? "כן" : "לא", {
    align: "center",
    ...(disputed ? { backgroundColor: COLORS.disputedBg, fontWeight: "bold" } : {}),
  });
}

// Column names in first-seen order across all cases.
export function attributeNames(attributes: Map<number, Attribute[]>): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const list of attributes.values()) {
    for (const a of list) {
      if (!seen.has(a.name)) {
        seen.add(a.name);
        names.push(a.name);
      }
    }
  }
  return names;
}

export function buildExportSheet(
  summaries: CaseSummary[],
  reviewers: Reviewer[],
  attributes: Map<number, Attribute[]>,
) {
  const sorted = [...reviewers].sort((a, b) => a.reviewer_slot - b.reviewer_slot);
  const names = attributeNames(attributes);

  const columns = [
    { header: "מספר מטופלת", width: 10 },
    ...sorted.flatMap((r) =>
      STAGES.map((stage) => ({ header: `מעריך ${r.reviewer_slot} - ${r.display_name} - ${STAGE_SHORT[stage]}`, width: 15 })),
    ),
    ...STAGES.map((stage) => ({ header: `הכרעת רוב - ${STAGE_SHORT[stage]}`, width: 13 })),
    ...STAGES.map((stage) => ({ header: `חילוקי דעות - ${STAGE_SHORT[stage]}`, width: 12 })),
    { header: "מספר דירוגים", width: 11 },
    { header: "קבלה", width: 70 },
    { header: "ממצאי אולטרסאונד שהוצגו למדרגים", width: 45 },
    ...names.map((name) => ({ header: name, width: 20 })),
  ];

  const header: Cell[] = columns.map((c) =>
    text(c.header, {
      fontWeight: "bold",
      textColor: COLORS.headerText,
      backgroundColor: COLORS.headerBg,
      alignVertical: "center",
      height: 36,
    }),
  );

  const rows: Cell[][] = summaries.map((s) => {
    const byName = new Map((attributes.get(s.case.id) ?? []).map((a) => [a.name, a.value]));
    const numeric = /^\d+$/.test(s.case.case_number);
    return [
      numeric
        ? { ...base, align: "center", type: Number, value: Number(s.case.case_number), fontWeight: "bold" }
        : text(s.case.case_number, { align: "center", fontWeight: "bold" }),
      ...sorted.flatMap((r) => STAGES.map((stage) => ratingCell(s.stages[stage].bySlot[r.reviewer_slot - 1]))),
      ...STAGES.map((stage) => ratingCell(s.stages[stage].majority)),
      ...STAGES.map((stage) => disputedCell(s.stages[stage].ambivalent)),
      { ...base, align: "center", type: Number, value: s.stages.entry.count + s.stages.operative.count },
      text(s.case.admission_text),
      text(s.case.ultrasound_text),
      ...names.map((name) => text(byName.get(name) ?? null)),
    ];
  });

  return {
    data: [header, ...rows],
    columns: columns.map((c) => ({ width: c.width })),
  };
}
