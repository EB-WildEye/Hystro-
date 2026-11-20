import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { ProgressBar } from "@/components/progress-bar";
import { requireRater, type Profile } from "@/lib/dal";
import { listDatasets, parseId, type Dataset } from "@/lib/datasets";
import { isRating, isStage, type Stage } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_NAV } from "./nav";
import { datasetProgress } from "./progress";
import { SwipeDeck } from "./swipe-deck";

function Message({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <>
      <Header title="דירוג היסטרוסקופיה" nav={REVIEW_NAV} userName={profile.display_name} tester={profile.role === "tester"} />
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-center">{children}</main>
    </>
  );
}

// With several files, the reviewer picks one by the name the admin gave it.
async function DatasetPicker({ profile, datasets }: { profile: Profile; datasets: Dataset[] }) {
  const progress = await Promise.all(datasets.map((d) => datasetProgress(d.id, profile.id)));
  return (
    <>
      <Header title="דירוג היסטרוסקופיה" nav={REVIEW_NAV} userName={profile.display_name} tester={profile.role === "tester"} />
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold">על איזה קובץ לעבוד?</h1>
        <ul className="mt-6 flex flex-col gap-3">
          {datasets.map((d, i) => (
            <li key={d.id}>
              <Link
                href={`/review?dataset=${d.id}`}
                className="block rounded-2xl bg-surface p-5 shadow-card transition hover:ring-2 hover:ring-accent"
              >
                <span className="mb-3 block text-lg font-semibold">{d.name}</span>
                <ProgressBar done={progress[i].done} total={progress[i].total} label={`התקדמות בקובץ ${d.name}`} unit="דירוגים" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

async function ReviewContent({ searchParams }: { searchParams: PageProps<"/review">["searchParams"] }) {
  const profile = await requireRater();
  const supabase = await createClient();
  const params = await searchParams;
  const requestedCase = parseId(params.case);
  const requestedStage: Stage = isStage(params.stage) ? params.stage : "entry";
  const returnTo = params.from === "mine" ? "mine" : undefined;
  const datasets = await listDatasets();

  // Which card to show: the one asked for, or the next unrated (case, stage)
  // in a dataset. Each case is two cards: entry, then operative.
  let caseId = requestedCase;
  let stage: Stage = requestedStage;
  let dataset: Dataset | undefined;
  if (caseId) {
    const { data } = await supabase.from("cases").select("dataset_id").eq("id", caseId).maybeSingle();
    dataset = datasets.find((d) => d.id === data?.dataset_id);
    if (!dataset) {
      return (
        <Message profile={profile}>
          <p>הקבלה לא נמצאה. ייתכן שהקובץ שלה נמחק.</p>
          <Link href="/review" className="mt-4 inline-block text-accent underline">
            חזרה לדירוג
          </Link>
        </Message>
      );
    }
  } else {
    if (datasets.length === 0) {
      return (
        <Message profile={profile}>
          <h1 className="text-2xl font-bold">עוד אין קבצים לדירוג</h1>
          <p className="mt-2 text-muted">כשיעלה קובץ קבלות, הוא יופיע כאן.</p>
        </Message>
      );
    }
    dataset = datasets.find((d) => d.id === parseId(params.dataset));
    if (!dataset && datasets.length === 1) dataset = datasets[0];
    if (!dataset) return <DatasetPicker profile={profile} datasets={datasets} />;

    const { data: state } = await supabase
      .from("reviewer_state")
      .select("last_sort_order, last_stage")
      .eq("reviewer_id", profile.id)
      .eq("dataset_id", dataset.id)
      .maybeSingle();
    const { data: next, error } = await supabase
      .rpc("next_unrated_item", {
        p_dataset_id: dataset.id,
        after_order: state?.last_sort_order ?? 0,
        after_stage: state?.last_stage ?? "operative",
      })
      .maybeSingle<{ case_id: number; stage: Stage }>();
    if (error) throw new Error(error.message);
    caseId = next?.case_id ?? null;
    if (next) stage = next.stage;
  }

  const { total, done } = await datasetProgress(dataset.id, profile.id);
  const progress = (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{dataset.name}</span>
        {datasets.length > 1 && (
          <Link href="/review" className="text-accent hover:underline">
            החלפת קובץ
          </Link>
        )}
      </div>
      <ProgressBar done={done} total={total} label={`התקדמות בקובץ ${dataset.name}`} unit="דירוגים" />
    </div>
  );

  if (!caseId) {
    return (
      <Message profile={profile}>
        {progress}
        <h1 className="mt-8 text-2xl font-bold">סיימת לדרג את כל הקבלות בקובץ</h1>
        <p className="mt-2 text-muted">תודה! אפשר לעבור על הדירוגים שלך ולערוך אותם.</p>
        <Link href="/review/mine" className="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 font-semibold text-on-accent">
          הדירוגים שלי
        </Link>
      </Message>
    );
  }

  const [{ data: c }, { data: own }] = await Promise.all([
    supabase.from("cases").select("id, case_number, admission_text, ultrasound_text").eq("id", caseId).maybeSingle(),
    supabase
      .from("ratings")
      .select("rating")
      .eq("case_id", caseId)
      .eq("reviewer_id", profile.id)
      .eq("stage", stage)
      .maybeSingle(),
  ]);
  if (!c) throw new Error("Case not found");
  const current = isRating(own?.rating) ? own.rating : null;

  return (
    <div className="flex h-dvh min-h-[34rem] flex-col">
      <Header title="דירוג היסטרוסקופיה" nav={REVIEW_NAV} userName={profile.display_name} tester={profile.role === "tester"} />
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
        {progress}
        <SwipeDeck
          key={`${c.id}-${stage}`}
          caseId={c.id}
          caseNumber={c.case_number}
          stage={stage}
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
