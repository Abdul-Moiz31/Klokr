import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ExtensionAuthSync } from "@/components/ExtensionAuthSync";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Klokrs — Tab Time Tracker for Engineers",
  description:
    "A silent tab tracker built for engineers who want honest data about their day. Install the extension, work normally, see everything.",
  keywords: [
    "time tracking",
    "tab tracker",
    "productivity",
    "software engineers",
    "chrome extension",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-[family-name:var(--font-inter)] antialiased bg-[#0A0A0F] text-white`}
      >
        <ExtensionAuthSync />
        {children}
      </body>
    </html>
  );
}
