"use server";

import { redirect } from "next/navigation";
import readExcelFile from "read-excel-file/node";
import { requireAdmin } from "@/lib/dal";
import { decodeCsv, parseCases, parseCsv, pickSheet, type RawSheet } from "@/lib/parse-cases";
import { createClient } from "@/lib/supabase/server";

export type UploadResult =
  | { ok: true; datasetId: number; name: string; cases: number; withUltrasound: number; attributeCount: number; sheet: string }
  | { ok: false; problems: string[] };

const MAX_BYTES = 10 * 1024 * 1024; // keep in step with serverActions.bodySizeLimit

async function readSheets(file: File): Promise<RawSheet[] | string> {
  const lower = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (lower.endsWith(".csv")) return [{ sheet: file.name, data: parseCsv(decodeCsv(bytes)) }];
  if (lower.endsWith(".xlsx")) {
    try {
      return (await readExcelFile(Buffer.from(bytes))) as RawSheet[];
    } catch {
      return "לא הצלחתי לקרוא את קובץ האקסל. כדאי לפתוח אותו באקסל ולשמור מחדש כ-xlsx.";
    }
  }
  if (lower.endsWith(".xls")) return 'קבצי xls ישנים לא נתמכים. באקסל: "שמירה בשם" ובחירה ב-Excel Workbook (.xlsx).';
  return "אפשר להעלות קובץ xlsx או csv בלבד.";
}

export async function uploadDataset(formData: FormData): Promise<UploadResult> {
  await requireAdmin();
  const file = formData.get("file");
  const name = String(formData.get("name") ?? "").trim();
  const sheetName = String(formData.get("sheet") ?? "").trim() || undefined;
  const usEmpty = String(formData.get("usEmpty") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!(file instanceof File) || file.size === 0) return { ok: false, problems: ["לא נבחר קובץ."] };
  if (file.size > MAX_BYTES) return { ok: false, problems: ["הקובץ גדול מ-10MB."] };
  if (!name) return { ok: false, problems: ["חסר שם לקובץ."] };

  const sheets = await readSheets(file);
  if (typeof sheets === "string") return { ok: false, problems: [sheets] };
  const sheet = pickSheet(sheets, sheetName);
  if ("problem" in sheet) return { ok: false, problems: [sheet.problem] };
  const parsed = parseCases(sheet, { usEmpty });
  if (!parsed.ok) return parsed;

  // One database call: the dataset and all its cases are created together,
  // or nothing is. The function itself checks the admin role.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_dataset", { p_name: name, p_cases: parsed.cases });
  if (error) {
    if (error.code === "23505" && error.message.includes("datasets_name_key")) {
      return { ok: false, problems: [`כבר יש קובץ בשם "${name}". נא לבחור שם אחר.`] };
    }
    return { ok: false, problems: [`השמירה נכשלה: ${error.message}`] };
  }

  return {
    ok: true,
    datasetId: data as number,
    name,
    cases: parsed.cases.length,
    withUltrasound: parsed.withUltrasound,
    attributeCount: parsed.attributeCount,
    sheet: parsed.sheet,
  };
}

// Opens or closes a dataset for rating. Closed datasets are hidden from
// reviewers and their ratings are frozen; the admin still sees everything.
export async function setDatasetActive(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("datasetId"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid dataset id");
  const active = formData.get("active") === "true";

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("datasets")
    .update({ is_active: active }, { count: "exact" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error("Dataset not updated");
  redirect("/admin/files");
}
