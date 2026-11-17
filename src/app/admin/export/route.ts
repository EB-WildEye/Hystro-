import writeExcelFile from "write-excel-file/node";
import { loadAdminData, loadCaseAttributes } from "@/lib/admin-data";
import { buildExportSheet } from "@/lib/export-sheet";

export async function GET() {
  // Both loaders call requireAdmin(); the database also restricts ratings
  // and annotation columns to admins via RLS.
  const [{ summaries, reviewers }, attributes] = await Promise.all([loadAdminData(), loadCaseAttributes()]);
  const { data, columns } = buildExportSheet(summaries, reviewers, attributes);

  const buffer = await writeExcelFile(
    data,
    { sheet: "דירוגים", columns, rightToLeft: true, stickyRowsCount: 1, stickyColumnsCount: 1 },
    { fontFamily: "Arial", fontSize: 11 },
  ).toBuffer();

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hysteroscopy-ratings-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
