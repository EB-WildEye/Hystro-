import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { requireReviewer } from "@/lib/dal";
import { isRating } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { SwipeDeck } from "./swipe-deck";

const NAV = [
  { href: "/review", label: "דירוג" },
  { href: "/review/mine", label: "הדירוגים שלי" },
];

async function ReviewContent({ searchParams }: { searchParams: PageProps<"/review">["searchParams"] }) {
  const profile = await requireReviewer();
  const supabase = await createClient();
  const params = await searchParams;
  const requested = Number(params.case);
  const returnTo = params.from === "mine" ? "mine" : undefined;

  let caseId: number | null = Number.isSafeInteger(requested) && requested > 0 ? requested : null;
  if (!caseId) {
    const { data: state } = await supabase
      .from("reviewer_state")
      .select("last_sort_order")
      .eq("reviewer_id", profile.id)
      .maybeSingle();
    const { data: next, error } = await supabase.rpc("next_unrated_case", {
      after_order: state?.last_sort_order ?? 0,
    });
    if (error) throw new Error(error.message);
    caseId = (next as number | null) ?? null;
  }

  const [{ count: total }, { count: mine }] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact", head: true }),
    supabase.from("ratings").select("id", { count: "exact", head: true }).eq("reviewer_id", profile.id),
  ]);

  const done = mine ?? 0;
  const all = total ?? 0;
  const progress = (
    <div className="flex items-center gap-3 text-sm text-muted">
      <div
        role="progressbar"
        aria-label="התקדמות בדירוג"
        aria-valuemin={0}
        aria-valuemax={all}
        aria-valuenow={done}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${all ? (done / all) * 100 : 0}%` }} />
      </div>
      <span className="tabular-nums">
        {done} מתוך {all}
      </span>
    </div>
  );

  const header = <Header title="דירוג היסטרוסקופיה" nav={NAV} userName={profile.display_name} />;

  if (!caseId) {
    return (
      <>
        {header}
        <main className="mx-auto w-full max-w-xl px-4 py-16 text-center">
          {progress}
          <h1 className="mt-8 text-2xl font-bold">סיימת לדרג את כל הקבלות</h1>
          <p className="mt-2 text-muted">תודה! אפשר לעבור על הדירוגים שלך ולשנות אותם.</p>
          <Link href="/review/mine" className="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 font-semibold text-white">
            הדירוגים שלי
          </Link>
        </main>
      </>
    );
  }

  const [{ data: c }, { data: own }] = await Promise.all([
    supabase.from("cases").select("id, case_number, admission_text, ultrasound_text").eq("id", caseId).maybeSingle(),
    supabase.from("ratings").select("rating").eq("case_id", caseId).eq("reviewer_id", profile.id).maybeSingle(),
  ]);
  if (!c) {
    return (
      <>
        {header}
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <p>הקבלה לא נמצאה.</p>
          <Link href="/review" className="mt-4 inline-block text-accent underline">חזרה לדירוג</Link>
        </main>
      </>
    );
  }
  const current = isRating(own?.rating) ? own.rating : null;

  return (
    <div className="flex h-dvh min-h-[34rem] flex-col">
      {header}
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
        <div className="mx-auto w-full max-w-2xl">{progress}</div>
        <SwipeDeck
          key={c.id}
          caseId={c.id}
          caseNumber={c.case_number}
          admission={c.admission_text}
          ultrasound={c.ultrasound_text}
          current={current}
          returnTo={returnTo}
        />
      </main>
    </div>
  );
}

export default function ReviewPage(props: PageProps<"/review">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <ReviewContent searchParams={props.searchParams} />
    </Suspense>
  );
}
