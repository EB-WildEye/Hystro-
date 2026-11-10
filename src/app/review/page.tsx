import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { CaseText } from "@/components/case-text";
import { requireReviewer } from "@/lib/dal";
import { isRating } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { RatingControls } from "./rating-controls";

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

  const progress = (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span>
        דירגת {mine ?? 0} מתוך {total ?? 0}
      </span>
      <div className="h-2 w-40 overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-accent"
          style={{ width: `${total ? Math.round(((mine ?? 0) / total) * 100) : 0}%` }}
        />
      </div>
    </div>
  );

  if (!caseId) {
    return (
      <>
        <Header title="דירוג היסטרוסקופיה" nav={NAV} userName={profile.display_name} />
        <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          {progress}
          <h1 className="mt-6 text-2xl font-bold">סיימת לדרג את כל הקבלות</h1>
          <p className="mt-2 text-muted">תודה! אפשר לעבור על הדירוגים שלך ולשנות אותם.</p>
          <Link href="/review/mine" className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-white">
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
        <Header title="דירוג היסטרוסקופיה" nav={NAV} userName={profile.display_name} />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p>הקבלה לא נמצאה.</p>
          <Link href="/review" className="mt-4 inline-block text-accent underline">חזרה לדירוג</Link>
        </main>
      </>
    );
  }
  const current = isRating(own?.rating) ? own.rating : null;

  return (
    <>
      <Header title="דירוג היסטרוסקופיה" nav={NAV} userName={profile.display_name} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">
            מטופלת מס&apos; <span dir="ltr">{c.case_number}</span>
          </h1>
          {progress}
        </div>
        {current && (
          <p className="rounded-lg bg-warn-soft px-4 py-2 text-sm text-warn">
            כבר דירגת קבלה זו. בחירה חדשה תחליף את הדירוג הקודם.
          </p>
        )}
        <CaseText admission={c.admission_text} ultrasound={c.ultrasound_text} />
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur">
          <p className="mb-3 font-semibold">מי צריך לבצע את ההיסטרוסקופיה?</p>
          <RatingControls key={c.id} caseId={c.id} current={current} returnTo={returnTo} />
        </div>
      </main>
    </>
  );
}

export default function ReviewPage(props: PageProps<"/review">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">טוען...</p>}>
      <ReviewContent searchParams={props.searchParams} />
    </Suspense>
  );
}
