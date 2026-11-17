"use client";

// Switches between light and dark. The choice is kept in this browser; until
// the viewer chooses, the system setting decides. The icon shown is picked
// by CSS (globals.css) so the server render never mismatches.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isDark =
      root.dataset.theme === "dark" ||
      (root.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be blocked; the theme still applies to this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="מעבר בין מצב בהיר למצב כהה"
      title="מצב בהיר / כהה"
      className="grid size-8 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      <svg className="theme-to-dark size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg className="theme-to-light size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
