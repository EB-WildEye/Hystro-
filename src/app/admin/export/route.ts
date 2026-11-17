import type { NextRequest } from "next/server";
import writeExcelFile from "write-excel-file/node";
import { adminContext, loadAdminData, loadCaseAttributes } from "@/lib/admin-data";
import { buildExportSheet } from "@/lib/export-sheet";

export async function GET(request: NextRequest) {
  // adminContext() and both loaders call requireAdmin(); the database also
  // restricts ratings and annotation columns to admins via RLS.
  const { dataset } = await adminContext(request.nextUrl.searchParams.get("dataset"));
  if (!dataset) return new Response("No dataset", { status: 404 });

  const [{ summaries, reviewers }, attributes] = await Promise.all([
    loadAdminData(dataset.id),
    loadCaseAttributes(dataset.id),
  ]);
  const { data, columns } = buildExportSheet(summaries, reviewers, attributes);

  const buffer = await writeExcelFile(
    data,
    { sheet: "דירוגים", columns, rightToLeft: true, stickyRowsCount: 1, stickyColumnsCount: 1 },
    { fontFamily: "Arial", fontSize: 11 },
  ).toBuffer();

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `${dataset.name} - דירוגים ${stamp}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // ASCII fallback plus the UTF-8 name (RFC 6266), so Hebrew names survive.
      "Content-Disposition": `attachment; filename="hysteroscopy-ratings-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
