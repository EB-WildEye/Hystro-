"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDataset } from "./actions";

// Deleting removes the file, its cases and all their ratings for everyone and
// cannot be undone, so the admin confirms by typing the file name.
export function DeleteDataset({ datasetId, name, cases }: { datasetId: number; name: string; cases: number }) {
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`מחיקת הקובץ ${name}`}
        className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-bg hover:text-specialist"
      >
        מחיקה
      </button>
    );
  }

  function remove(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await deleteDataset(datasetId, typed);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={remove} className="w-full rounded-xl bg-warn-soft p-3 text-sm text-ink">
      <p className="font-semibold">
        המחיקה תסיר את &quot;{name}&quot;, {cases} קבלות וכל הדירוגים שלהן, אצל כל הסוקרים. אי אפשר לבטל אותה.
      </p>
      <p className="mt-1">כדאי לייצא לאקסל לפני. לאישור, הקלידו את שם הקובץ:</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          aria-label="שם הקובץ לאישור המחיקה"
          className="rounded-lg border border-line bg-surface px-3 py-1.5 outline-none focus:border-specialist"
        />
        <button
          type="submit"
          disabled={pending || typed.trim() !== name}
          className="rounded-full bg-specialist px-3 py-1.5 font-semibold text-on-accent disabled:opacity-40"
        >
          מחיקה לצמיתות
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setAsking(false);
            setTyped("");
            setError(null);
          }}
          className="rounded-full border border-line bg-surface px-3 py-1.5"
        >
          ביטול
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 font-semibold text-specialist">
          {error}
        </p>
      )}
    </form>
  );
}
