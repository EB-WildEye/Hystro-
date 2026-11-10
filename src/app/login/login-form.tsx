"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const linkError = useSearchParams().get("error") === "link";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    // shouldCreateUser: false - only accounts created by the admin script can sign in.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    // The same message is shown either way, so the form does not reveal
    // which addresses have accounts.
    setState(error && error.status !== 422 && error.status !== 400 ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <p className="mt-6 rounded-lg bg-accent-soft p-4 text-accent">
        אם הכתובת רשומה במערכת, נשלח אליה קישור כניסה. אפשר לסגור את הלשונית הזו.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      {linkError && (
        <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">הקישור פג תוקף או כבר נוצל. אפשר לבקש קישור חדש.</p>
      )}
      <label htmlFor="email" className="text-sm font-semibold">
        כתובת מייל
      </label>
      <input
        id="email"
        type="email"
        required
        dir="ltr"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-left outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-2 rounded-lg bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {state === "sending" ? "שולח..." : "שליחת קישור כניסה"}
      </button>
      {state === "error" && <p className="text-sm text-specialist">אירעה שגיאה. נסו שוב בעוד דקה.</p>}
    </form>
  );
}
