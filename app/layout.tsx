import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-text" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "600"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "EMU jadval",
  description: "EMU dars jadvali: kunlik taxta, o'qituvchilar va Telegram orqali kunlik xabarlar",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1F3F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1117" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${onest.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
