"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameDataset } from "./actions";

// Inline rename. Reviewers pick files by this name.
export function RenameDataset({ datasetId, name }: { datasetId: number; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setError(null);
          setEditing(true);
        }}
        aria-label={`שינוי השם של ${name}`}
        className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft"
      >
        שינוי שם
      </button>
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await renameDataset(datasetId, value);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 text-sm">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        aria-label="שם חדש לקובץ"
        className="rounded-lg border border-line bg-surface px-3 py-1.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
      <button type="submit" disabled={pending} className="rounded-full bg-accent px-3 py-1.5 font-semibold text-on-accent disabled:opacity-50">
        שמירה
      </button>
      <button type="button" disabled={pending} onClick={() => setEditing(false)} className="rounded-full border border-line px-3 py-1.5">
        ביטול
      </button>
      {error && (
        <span role="alert" className="w-full text-specialist">
          {error}
        </span>
      )}
    </form>
  );
}
