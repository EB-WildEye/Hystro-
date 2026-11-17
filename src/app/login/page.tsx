import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-16">
      <div className="absolute end-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold">דירוג היסטרוסקופיה</h1>
        <p className="mt-2 text-muted">הכניסה למשתמשים מורשים בלבד. נשלח אליך קישור כניסה למייל.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
