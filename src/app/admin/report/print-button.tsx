"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">
      הורדה כ-PDF
    </button>
  );
}
