"use client";

import { useState, useTransition } from "react";
import { removeRating } from "../actions";

// Two-step removal: the first click asks, the second one removes.
export function RemoveRating({ caseId, caseNumber }: { caseId: number; caseNumber: string }) {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    setFailed(false);
    const data = new FormData();
    data.set("caseId", String(caseId));
    startTransition(async () => {
      try {
        await removeRating(data);
      } catch (error) {
        // A redirect is signalled by throwing; let the framework handle it.
        if (error && typeof error === "object" && "digest" in error) throw error;
        setFailed(true);
      }
    });
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`הסרת הדירוג של מטופלת ${caseNumber}`}
        className="me-3 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-bg hover:text-ink"
      >
        הסרה
      </button>
    );
  }

  return (
    <span className="me-3 flex items-center gap-2 text-sm">
      {failed ? <span className="text-specialist">ההסרה נכשלה</span> : <span className="text-muted">להסיר את הדירוג?</span>}
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="rounded-full bg-specialist px-3 py-1.5 font-semibold text-white disabled:opacity-50"
      >
        הסרה
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(false)}
        className="rounded-full border border-line px-3 py-1.5 disabled:opacity-50"
      >
        ביטול
      </button>
    </span>
  );
}
