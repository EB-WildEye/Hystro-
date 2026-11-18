"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadDataset, type UploadResult } from "./actions";

// Submitted by hand rather than through <form action>, so a failed upload
// keeps the chosen file and fields and the admin can fix and resend.
export function UploadForm() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !name) setName(file.name.replace(/\.(xlsx|csv)$/i, ""));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await uploadDataset(data);
        setResult(res);
        if (res.ok) {
          form.reset();
          setName("");
          router.refresh(); // show the new file in the list beside the form
        }
      } catch {
        setResult({ ok: false, problems: ["ההעלאה נכשלה. בדקו את החיבור ונסו שוב."] });
      }
    });
  }

  const field = "rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">קובץ קבלות</span>
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={onFile}
          className="text-sm file:me-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:font-semibold file:text-accent"
        />
        <span className="text-sm text-muted">
          xlsx או csv. שלוש העמודות הראשונות: מספר מטופלת, קבלה, US. שאר העמודות נשמרות לייצוא האקסל ולא מוצגות לסוקרים.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">שם הקובץ במערכת</span>
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </label>

      <details className="text-sm">
        <summary className="cursor-pointer text-accent">הגדרות נוספות</summary>
        <div className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">ערכים בעמודת US שמשמעותם &quot;אין אולטרסאונד&quot;</span>
            <input name="usEmpty" defaultValue="0" dir="ltr" className={`${field} text-right`} />
            <span className="text-muted">מופרדים בפסיק. הסוקרים יראו &quot;אין ממצאי אולטרסאונד&quot; במקומם.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">שם הגיליון</span>
            <input name="sheet" className={field} placeholder="ריק = בחירה אוטומטית" />
            <span className="text-muted">צריך רק כשבקובץ כמה גיליונות עם קבלות.</span>
          </label>
        </div>
      </details>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-accent px-6 py-2.5 font-semibold text-on-accent disabled:opacity-60"
      >
        {pending ? "מעלה..." : "העלאה"}
      </button>

      {result?.ok && (
        <div role="status" className="rounded-xl bg-junior-soft p-4 text-ink">
          <p className="font-semibold">
            הקובץ &quot;{result.name}&quot; נוסף, והסוקרים כבר יכולים לדרג אותו.
          </p>
          <p className="mt-1 text-sm">
            {result.cases} קבלות, מתוכן {result.withUltrasound} עם ממצאי אולטרסאונד, ו-{result.attributeCount} עמודות נוספות
            לייצוא. נקרא מהגיליון &quot;{result.sheet}&quot;.
          </p>
          <Link href={`/admin?dataset=${result.datasetId}`} className="mt-2 inline-block text-sm font-semibold text-accent underline">
            לדשבורד של הקובץ
          </Link>
        </div>
      )}
      {result && !result.ok && (
        <div role="alert" className="rounded-xl bg-warn-soft p-4 text-ink">
          <p className="font-semibold">הקובץ לא נוסף. שום דבר לא נשמר.</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            {result.problems.slice(0, 20).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {result.problems.length > 20 && <p className="mt-1 text-sm">ועוד {result.problems.length - 20} בעיות.</p>}
        </div>
      )}
    </form>
  );
}
