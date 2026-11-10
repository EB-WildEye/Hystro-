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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
