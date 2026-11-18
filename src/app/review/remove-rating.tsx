"use client";

import { useState, useTransition } from "react";
import { STAGE_SHORT, type Stage } from "@/lib/labels";
import { removeRating } from "./actions";

// Two-step removal: the first click asks, the second one removes.
// returnTo "case" stays on the case after removing; the default goes back to
// the ratings list.
export function RemoveRating({
  caseId,
  caseNumber,
  stage,
  returnTo,
}: {
  caseId: number;
  caseNumber: string;
  stage: Stage;
  returnTo?: "case";
}) {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    setFailed(false);
    const data = new FormData();
    data.set("caseId", String(caseId));
    data.set("stage", stage);
    if (returnTo) data.set("returnTo", returnTo);
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
        aria-label={`הסרת הדירוג של מטופלת ${caseNumber}, ${STAGE_SHORT[stage]}`}
        className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-bg hover:text-ink"
      >
        הסרה
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      {failed ? <span className="text-danger">ההסרה נכשלה</span> : <span className="text-muted">להסיר את הדירוג?</span>}
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="rounded-full bg-danger px-3 py-1.5 font-semibold text-on-accent disabled:opacity-50"
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
