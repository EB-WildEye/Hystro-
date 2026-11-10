"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { RATING_LABEL, type Rating } from "@/lib/labels";
import { rateCase, skipCase } from "./actions";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} className="contents">{children}</fieldset>;
}

export function RatingControls({
  caseId,
  current,
  returnTo,
}: {
  caseId: number;
  current: Rating | null;
  returnTo?: "mine";
}) {
  const residentRef = useRef<HTMLButtonElement>(null);
  const specialistRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  // Keyboard shortcuts: 1 = resident, 2 = specialist, N or left arrow = next.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "1") residentRef.current?.click();
      else if (e.key === "2") specialistRef.current?.click();
      else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "n") skipRef.current?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const base = "rounded-xl border-2 px-6 py-4 text-lg font-bold transition disabled:opacity-50";
  const style = (r: Rating) => {
    const selected = current === r;
    if (r === "resident")
      return `${base} ${selected ? "border-resident bg-resident text-white" : "border-resident text-resident hover:bg-resident-soft"}`;
    return `${base} ${selected ? "border-specialist bg-specialist text-white" : "border-specialist text-specialist hover:bg-specialist-soft"}`;
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <form action={rateCase} className="flex flex-1 gap-3">
        <Pending>
          <input type="hidden" name="caseId" value={caseId} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button ref={residentRef} name="rating" value="resident" className={`flex-1 ${style("resident")}`}>
            {RATING_LABEL.resident}
            <span className="ms-2 text-xs font-normal opacity-70">(1)</span>
          </button>
          <button ref={specialistRef} name="rating" value="specialist" className={`flex-1 ${style("specialist")}`}>
            {RATING_LABEL.specialist}
            <span className="ms-2 text-xs font-normal opacity-70">(2)</span>
          </button>
        </Pending>
      </form>
      <form action={skipCase}>
        <Pending>
          <input type="hidden" name="caseId" value={caseId} />
          <button
            ref={skipRef}
            className="h-full w-full rounded-xl border-2 border-line px-6 py-4 text-lg font-semibold text-muted hover:bg-surface disabled:opacity-50"
          >
            הבא ←
          </button>
        </Pending>
      </form>
    </div>
  );
}
