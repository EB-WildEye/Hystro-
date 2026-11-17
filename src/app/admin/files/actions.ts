"use server";

import { revalidatePath } from "next/cache";
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

export type ManageResult = { ok: true } | { ok: false; error: string };

// Renames a dataset. Reviewers choose files by this name.
export async function renameDataset(datasetId: number, rawName: string): Promise<ManageResult> {
  await requireAdmin();
  const name = rawName.trim();
  if (!name) return { ok: false, error: "השם לא יכול להיות ריק." };

  const supabase = await createClient();
  const { error, count } = await supabase.from("datasets").update({ name }, { count: "exact" }).eq("id", datasetId);
  if (error?.code === "23505") return { ok: false, error: `כבר יש קובץ בשם "${name}".` };
  if (error) return { ok: false, error: `השינוי נכשל: ${error.message}` };
  if (count === 0) return { ok: false, error: "הקובץ לא נמצא." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Deletes a dataset with its cases, their ratings and annotation columns, for
// everyone. The rating audit trail is kept. The admin confirms by typing the
// file name, checked here against the name in the database.
export async function deleteDataset(datasetId: number, typedName: string): Promise<ManageResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: dataset, error: readError } = await supabase.from("datasets").select("name").eq("id", datasetId).maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!dataset) return { ok: false, error: "הקובץ לא נמצא." };
  if (typedName.trim() !== dataset.name) return { ok: false, error: "השם שהוקלד לא תואם לשם הקובץ." };

  const { error, count } = await supabase.from("datasets").delete({ count: "exact" }).eq("id", datasetId);
  if (error) return { ok: false, error: `המחיקה נכשלה: ${error.message}` };
  if (count === 0) return { ok: false, error: "הקובץ לא נמחק." };
  revalidatePath("/", "layout");
  return { ok: true };
}
