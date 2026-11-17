"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { RATING_LABEL, type Rating } from "@/lib/labels";
import { rateCase, skipCase } from "./actions";
import { RemoveRating } from "./remove-rating";

type Choice = Rating | "skip";

// Swipe right = resident, swipe left = specialist. The same choices are
// available as buttons and as the right / left arrow keys.
const COMMIT_DISTANCE = 130; // px the card must travel before a swipe counts
const AXIS_LOCK = 10; // px of movement before deciding swipe vs. scroll

export function SwipeDeck({
  caseId,
  caseNumber,
  admission,
  ultrasound,
  current,
  returnTo,
}: {
  caseId: number;
  caseNumber: string;
  admission: string;
  ultrasound: string | null;
  current: Rating | null;
  returnTo?: "mine";
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<Choice | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const start = useRef<{ x: number; y: number; id: number; axis: "x" | "y" | null } | null>(null);
  const busy = pending || leaving !== null;

  function choose(choice: Choice) {
    if (busy) return;
    setFailed(false);
    setLeaving(choice);
    const data = new FormData();
    data.set("caseId", String(caseId));
    if (returnTo) data.set("returnTo", returnTo);
    if (choice !== "skip") data.set("rating", choice);
    startTransition(async () => {
      try {
        // On success the action redirects and this card is replaced.
        await (choice === "skip" ? skipCase(data) : rateCase(data));
      } catch (error) {
        // A redirect is signalled by throwing; let the framework handle it.
        if (error && typeof error === "object" && "digest" in error) throw error;
        setLeaving(null);
        setDx(0);
        setFailed(true);
      }
    });
  }

  // Latest choose() for the key listener, without re-subscribing every render.
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") chooseRef.current("resident");
      else if (e.key === "ArrowLeft") chooseRef.current("specialist");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (busy || (e.pointerType === "mouse" && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null };
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const moveX = e.clientX - s.x;
    const moveY = e.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(moveX) < AXIS_LOCK && Math.abs(moveY) < AXIS_LOCK) return;
      s.axis = Math.abs(moveX) > Math.abs(moveY) ? "x" : "y";
      if (s.axis === "x") {
        e.currentTarget.setPointerCapture(e.pointerId);
        window.getSelection()?.removeAllRanges();
        setDragging(true);
      }
    }
    if (s.axis === "x") setDx(moveX);
  }

  function onPointerEnd(e: React.PointerEvent<HTMLElement>) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    if (s.axis !== "x") return;
    setDragging(false);
    const moveX = e.clientX - s.x;
    if (e.type === "pointerup" && Math.abs(moveX) >= COMMIT_DISTANCE) {
      choose(moveX > 0 ? "resident" : "specialist");
    } else {
      setDx(0);
    }
  }

  // Where the card sits: following the finger, flying out, or at rest.
  const exitX = leaving === "resident" ? 900 : leaving === "specialist" ? -900 : 0;
  const x = leaving ? exitX : dx;
  const lean = leaving === "skip" ? 0 : x / 28;
  const pull = Math.min(Math.abs(x) / COMMIT_DISTANCE, 1);
  const toward: Rating | null = x > 0 ? "resident" : x < 0 ? "specialist" : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-5">
      <div className="relative w-full max-w-2xl flex-1">
        {/* The next card in the pile, peeking out underneath. */}
        <div aria-hidden className="absolute inset-x-4 -bottom-2 top-2 rounded-[28px] bg-surface/60 shadow-card" />

        <article
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{
            transform: `translateX(${x}px) rotate(${lean}deg)`,
            opacity: leaving ? 0 : 1,
            touchAction: "pan-y",
          }}
          className={`swipe-card absolute inset-0 flex flex-col overflow-hidden rounded-[28px] bg-surface shadow-card ${
            dragging ? "cursor-grabbing select-none" : "cursor-grab swipe-card-settle"
          }`}
        >
          <header className="flex items-baseline justify-between gap-4 border-b border-line px-6 py-4 sm:px-8">
            <h1 className="text-lg font-bold">
              מטופלת <span dir="ltr">{caseNumber}</span>
            </h1>
            {current && (
              <div className="flex flex-wrap items-center justify-end gap-x-1 text-sm text-muted">
                <span>
                  דירגת: <span className="font-semibold text-ink">{RATING_LABEL[current]}</span>
                </span>
                <RemoveRating caseId={caseId} caseNumber={caseNumber} returnTo="case" />
              </div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
            <h2 className="mb-2 text-sm font-semibold text-accent">קבלה במיון</h2>
            <p className="clinical-text">{admission}</p>

            <h2 className="mb-2 mt-7 border-t border-line pt-5 text-sm font-semibold text-accent">
              ממצאי אולטרסאונד
            </h2>
            {ultrasound?.trim() ? (
              <p className="clinical-text">{ultrasound}</p>
            ) : (
              <p className="text-muted">אין ממצאי אולטרסאונד</p>
            )}
          </div>

          {/* Verdict stamp: fades in as the card is pulled to a side. */}
          {toward && (
            <div
              aria-hidden
              style={{ opacity: pull }}
              className={`pointer-events-none absolute inset-0 flex items-start px-8 pt-24 ${
                toward === "resident" ? "justify-end bg-resident/10" : "justify-start bg-specialist/10"
              }`}
            >
              <span
                dir="rtl"
                className={`rounded-2xl border-4 bg-surface/90 px-5 py-2 text-3xl font-extrabold ${
                  toward === "resident"
                    ? "-rotate-6 border-resident text-resident"
                    : "rotate-6 border-specialist text-specialist"
                }`}
              >
                {RATING_LABEL[toward]}
              </span>
            </div>
          )}
        </article>
      </div>

      {failed && (
        <p role="alert" className="text-sm font-semibold text-specialist">
          הדירוג לא נשמר. בדקו את החיבור ונסו שוב.
        </p>
      )}

      {/* dir=ltr keeps each button on the side its swipe goes to. */}
      <div dir="ltr" className="flex w-full max-w-2xl items-stretch gap-3 pb-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => choose("specialist")}
          className={`choice-btn flex-1 border-specialist ${
            current === "specialist" ? "bg-specialist text-on-accent" : "text-specialist hover:bg-specialist-soft"
          }`}
        >
          {RATING_LABEL.specialist}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => choose("skip")}
          className="choice-btn border-line px-6 text-muted hover:bg-surface"
        >
          הבא
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => choose("resident")}
          className={`choice-btn flex-1 border-resident ${
            current === "resident" ? "bg-resident text-on-accent" : "text-resident hover:bg-resident-soft"
          }`}
        >
          {RATING_LABEL.resident}
        </button>
      </div>
    </div>
  );
}
