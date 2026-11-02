import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-onest" });

export const metadata: Metadata = {
  title: "EMU dars jadvali",
  description: "O'qituvchilar bo'yicha EMU dars jadvali",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={onest.variable}>
      <body>{children}</body>
    </html>
  );
}
