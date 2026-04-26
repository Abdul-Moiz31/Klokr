import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports — Klokr",
  description: "Weekly, monthly, and daily time reports with PDF export.",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
