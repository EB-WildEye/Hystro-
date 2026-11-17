import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (Assistant, SIL Open Font License) so builds never depend on
// reaching Google Fonts.
const assistant = localFont({
  variable: "--font-assistant",
  src: [
    { path: "./fonts/assistant-hebrew-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/assistant-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "דירוג היסטרוסקופיה",
  description: "דירוג רמת המבצע הנדרשת להיסטרוסקופיה",
  robots: { index: false, follow: false },
};

// Applies a saved theme before the first paint, so dark mode never flashes
// light. Runs before React, hence suppressHydrationWarning on <html>.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
