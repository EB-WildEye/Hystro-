import { loadAdminData } from "@/lib/admin-data";
import { toCsv } from "@/lib/csv";
import { RATING_LABEL } from "@/lib/labels";

export async function GET() {
  // loadAdminData() calls requireAdmin(); the database also restricts the
  // full rating matrix to admins via RLS.
  const { summaries, reviewers } = await loadAdminData();

  const header = [
    "מספר מטופלת",
    "קבלה",
    "ממצאי אולטרסאונד",
    ...reviewers.map((r) => `מעריך ${r.reviewer_slot} - ${r.display_name}`),
    "מספר דירוגים",
    "הכרעת רוב",
    "אמביוולנטי",
  ];
  const rows = summaries.map((s) => [
    s.case.case_number,
    s.case.admission_text,
    s.case.ultrasound_text ?? "",
    ...reviewers.map((r) => {
      const v = s.bySlot[r.reviewer_slot - 1];
      return v ? RATING_LABEL[v] : "";
    }),
    s.count,
    s.majority ? RATING_LABEL[s.majority] : "",
    s.ambivalent ? "כן" : "לא",
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hysteroscopy-ratings-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
