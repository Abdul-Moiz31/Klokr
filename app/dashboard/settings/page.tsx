"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/lib/useAuthSession";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Loader } from "@/components/ui/Loader";
import { BillingCard } from "@/components/dashboard/BillingCard";
import { AiSettingsTab } from "@/components/dashboard/AiSettingsTab";
import { DEFAULT_PREFS, loadPrefs, savePrefs, resolveTimezone, type KlokrsPrefs } from "@/lib/prefs";
import { getSiteName } from "@/lib/domain";
import { getCategoryForDomain, getCategoryStats, CATEGORIES, hexToRgb } from "@/lib/categories";
import type { CategoryId } from "@/lib/categories";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { User } from "@supabase/supabase-js";

/* ─── Diagnostics types ──────────────────────────────────── */

interface DiagnosticsData {
  connected: boolean;
  lastDbWrite: string | null;
  sessionsToday: number;
  pendingWrites: number;
  lastSyncTs: number | null;
  lastSyncStatus: "ok" | "fail" | null;
  extensionVersion: string | null;
  browser: string;
  accountId: string;
  accountCreatedAt: string | null;
  idleTimeoutMinutes: number;
  minSessionSeconds: number;
  workHours: string;
}

interface DiagnosticsApiResponse {
  connected: boolean;
  user_id: string;
  account_created_at: string | null;
  last_db_write: string | null;
  sessions_today: number;
}

/* ─── Primitives ─────────────────────────────────────────── */

function SectionTitle({ children, tooltip }: { children: ReactNode; tooltip?: string }) {
  return (
    <div className="mb-4 flex items-center gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{children}</p>
      {tooltip && <InfoTooltip text={tooltip} side="bottom" />}
    </div>
  );
}

function PrefRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 py-3.5 border-b border-white/[0.05] last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/80">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-white/35">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.14] bg-white/[0.03] shadow-lg shadow-black/30 transition-colors hover:border-white/[0.20]">
      <div className="px-4 py-1 sm:px-5">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] ${
        checked ? "border-violet-500/50 bg-violet-600" : "border-white/15 bg-white/10 hover:bg-white/[0.14]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ChipSelect<T extends number | string>({
  options,
  value,
  format,
  onChange,
}: {
  options: T[];
  value: T;
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] ${
            value === o
              ? "bg-violet-600/80 text-white border border-violet-500/40"
              : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

/* ─── Export ─────────────────────────────────────────────── */

function getTzOffsetLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset.replace("GMT", "UTC") || "UTC+00:00";
  } catch {
    return "";
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type C = [number, number, number];
const P = {
  bg:     [10,  10,  15]  as C,
  violet: [124, 58,  237] as C,
  cyan:   [6,   182, 212] as C,
  card:   [17,  17,  24]  as C,
  border: [31,  31,  46]  as C,
  body:   [226, 232, 240] as C,
  muted:  [100, 116, 139] as C,
  white:  [255, 255, 255] as C,
};

interface SummaryRow {
  date: string;
  domain: string;
  totalSeconds: number;
  visits: number;
}

function generateExportPdf(
  rows: SummaryRow[],
  fromDate: string,
  toDate: string,
  userEmail: string,
  preview: { days: number; totalSeconds: number },
  categoryOverrides: Record<string, CategoryId> = {},
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;

  const fillBg = () => { doc.setFillColor(...P.bg); doc.rect(0, 0, pageW, pageH, "F"); };
  fillBg();

  const _addPage = doc.addPage.bind(doc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).addPage = (...args: unknown[]) => { const r = (_addPage as any)(...args); fillBg(); return r; };

  const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const periodLabel = `${new Date(fromDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${new Date(toDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Aggregate domain totals and daily totals for charts
  const domainTotals = new Map<string, number>();
  const dailyTotals = new Map<string, number>();
  for (const r of rows) {
    domainTotals.set(r.domain, (domainTotals.get(r.domain) ?? 0) + r.totalSeconds);
    dailyTotals.set(r.date, (dailyTotals.get(r.date) ?? 0) + r.totalSeconds);
  }
  const topSite = [...domainTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ? getSiteName([...domainTotals.entries()].sort((a, b) => b[1] - a[1])[0]![0])
    : "—";
  const uniqueDomains = domainTotals.size;

  const dailyChartData = [...dailyTotals.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, sec]) => ({
      label: new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        month: "numeric", day: "numeric",
      }),
      value: parseFloat((sec / 3600).toFixed(2)),
    }));

  const domainForCats = [...domainTotals.entries()].map(([domain, total_seconds]) => ({ domain, total_seconds }));
  const catStats = getCategoryStats(domainForCats, categoryOverrides).slice(0, 7);

  // ── 1. Header bar ─────────────────────────────────────────
  const hdrH = 20;
  doc.setFillColor(...P.violet);
  doc.rect(0, 0, pageW, hdrH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...P.white);
  doc.text("Klokrs", M, 13.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Data Export  ·  ${periodLabel}`, pageW - M, 13.5, { align: "right" });

  // ── 2. Divider ────────────────────────────────────────────
  doc.setDrawColor(56, 29, 104);
  doc.setLineWidth(0.4);
  doc.line(M, hdrH + 1, pageW - M, hdrH + 1);

  let y = hdrH + 9;

  // ── 3. Overview (4 stat cards) ────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...P.cyan);
  doc.text("OVERVIEW", M, y);
  y += 5;

  const stats = [
    { title: "Days Tracked", value: String(preview.days) },
    { title: "Total Time", value: formatDuration(preview.totalSeconds) },
    { title: "Top Site", value: topSite },
    { title: "Unique Domains", value: String(uniqueDomains) },
  ];
  const statGap = 3;
  const boxW = (pageW - M * 2 - statGap * 3) / 4;
  const boxH = 24;
  for (let i = 0; i < 4; i++) {
    const bx = M + i * (boxW + statGap);
    doc.setFillColor(...P.card);
    doc.roundedRect(bx, y, boxW, boxH, 1.5, 1.5, "F");
    doc.setDrawColor(...P.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, boxH, 1.5, 1.5, "D");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...P.muted);
    doc.text(stats[i]!.title.toUpperCase(), bx + 4, y + 7);
    const valFontSize = stats[i]!.value.length > 7 ? 12 : 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(valFontSize);
    doc.setTextColor(...P.body);
    doc.text(stats[i]!.value, bx + 4, y + 17.5);
    doc.setFillColor(...P.violet);
    doc.rect(bx + 4, y + 20, 8, 0.6, "F");
  }
  y += boxH + 8;

  // ── 4. Daily activity bar chart ───────────────────────────
  doc.setFillColor(...P.violet);
  doc.rect(M, y - 3.5, 1.2, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...P.cyan);
  doc.text("DAILY ACTIVITY", M + 3.5, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...P.muted);
  doc.text("hours per day", pageW - M, y, { align: "right" });
  y += 5;

  // Draw chart
  const chartH = 38;
  const axisX = M + 9;
  const axisY = y + chartH;
  const chartW = pageW - M - axisX - M;
  const maxVal = Math.max(...dailyChartData.map((p) => p.value), 0.01);

  doc.setFillColor(17, 17, 24);
  doc.roundedRect(M, y - 2, pageW - M * 2, chartH + 8, 1.5, 1.5, "F");
  doc.setDrawColor(31, 31, 46);
  doc.setLineWidth(0.25);
  doc.roundedRect(M, y - 2, pageW - M * 2, chartH + 8, 1.5, 1.5, "D");

  // Gridlines + Y labels
  for (let t = 1; t <= 3; t++) {
    const gy = axisY - (t / 3) * chartH;
    doc.setDrawColor(31, 31, 46);
    doc.setLineWidth(0.2);
    doc.line(axisX, gy, axisX + chartW, gy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...P.muted);
    doc.text(`${((maxVal * t) / 3).toFixed(1)}h`, axisX - 1.5, gy, { align: "right", baseline: "middle" as const });
  }
  doc.setDrawColor(44, 44, 58);
  doc.setLineWidth(0.3);
  doc.line(axisX, y - 2, axisX, axisY);
  doc.line(axisX, axisY, axisX + chartW, axisY);

  // Bars
  const n = dailyChartData.length;
  const barW = n > 0 ? Math.max(1.2, (chartW - Math.max(0, n - 1) * 1.5) / n) : 0;
  const gap = n > 1 ? (chartW - barW * n) / (n - 1) : 0;

  for (let i = 0; i < n; i++) {
    const bx = axisX + i * (barW + gap);
    const bh = (dailyChartData[i]!.value / maxVal) * chartH;
    if (bh > 0.3) {
      doc.setFillColor(124, 58, 237);
      doc.rect(bx, axisY - bh, barW, bh, "F");
      doc.setFillColor(80, 120, 230);
      doc.rect(bx, axisY - bh, barW, bh * 0.32, "F");
    }
    const showLabel = n <= 10 || (n <= 20 && i % 2 === 0) || (n > 20 && (i === 0 || (i + 1) % 5 === 0));
    if (showLabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(...P.muted);
      doc.text(dailyChartData[i]!.label, bx + barW / 2, axisY + 3, { align: "center", baseline: "top" as const });
    }
  }
  y += chartH + 13;

  // ── 5. Category breakdown ─────────────────────────────────
  if (catStats.length >= 2) {
    doc.setFillColor(...P.violet);
    doc.rect(M, y - 3.5, 1.2, 4.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...P.cyan);
    doc.text("BY CATEGORY", M + 3.5, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...P.muted);
    doc.text("time per activity type", pageW - M, y, { align: "right" });
    y += 5;

    const grandTotal = preview.totalSeconds || 1;
    const maxCatSec = catStats[0]?.seconds ?? 1;
    const rowH = 7.5;
    const labelW = 28;
    const timeW = 22;
    const barAreaW = pageW - M * 2 - labelW - timeW - 2;

    for (const cat of catStats) {
      const pct = Math.round((cat.seconds / grandTotal) * 100);
      const barFillW = Math.max(1, (cat.seconds / maxCatSec) * barAreaW);
      const barAreaX = M + labelW;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...P.muted);
      doc.text(cat.label, M, y + rowH / 2, { baseline: "middle" as const });

      doc.setFillColor(22, 22, 32);
      doc.roundedRect(barAreaX, y + 2, barAreaW, rowH - 4, 0.8, 0.8, "F");
      const [r, g, b] = hexToRgb(cat.color);
      doc.setFillColor(r, g, b);
      doc.roundedRect(barAreaX, y + 2, barFillW, rowH - 4, 0.8, 0.8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...P.body);
      doc.text(formatDuration(cat.seconds), M + labelW + barAreaW + 2, y + rowH / 2, { baseline: "middle" as const });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...P.muted);
      doc.text(`${pct}%`, pageW - M, y + rowH / 2, { align: "right", baseline: "middle" as const });

      y += rowH + 1;
    }
    y += 5;
  }

  // ── 6. Domain table ───────────────────────────────────────
  doc.setFillColor(...P.violet);
  doc.rect(M, y - 3.5, 1.2, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...P.cyan);
  doc.text("BROWSING SUMMARY", M + 3.5, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...P.muted);
  doc.text(`${rows.length} records`, pageW - M, y, { align: "right" });
  y += 4;

  const grandTotal = rows.reduce((s, r) => s + r.totalSeconds, 0) || 1;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    head: [["Date", "Site", "Category", "Time Spent", "Visits", "% of Total"]],
    body: rows.map((r) => [
      new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      getSiteName(r.domain),
      CATEGORIES[getCategoryForDomain(r.domain, categoryOverrides)].label,
      formatDuration(r.totalSeconds),
      String(r.visits),
      `${Math.round((r.totalSeconds / grandTotal) * 100)}%`,
    ]),
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: "auto" as const },
      2: { cellWidth: 24 },
      3: { cellWidth: 22, halign: "right" as const },
      4: { cellWidth: 16, halign: "right" as const },
      5: { cellWidth: 28 },
    },
    headStyles: {
      fillColor: P.violet,
      textColor: P.white,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor: P.bg,
      textColor: P.body,
      fontSize: 8.5,
      lineColor: P.border,
      lineWidth: 0.2,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: P.card },
    showHead: "everyPage",

    didDrawPage: () => {
      doc.setFillColor(...P.card);
      doc.rect(0, pageH - 12, pageW, 12, "F");
      doc.setDrawColor(...P.border);
      doc.setLineWidth(0.3);
      doc.line(0, pageH - 12, pageW, pageH - 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...P.muted);
      doc.text("Generated by Klokrs", M, pageH - 5);
      doc.text(userEmail, pageW / 2, pageH - 5, { align: "center" });
      doc.text(generatedDate, pageW - M, pageH - 5, { align: "right" });
    },

    didDrawCell: (data) => {
      if (data.section !== "body") return;

      // Category column (idx 2) — coloured text
      if (data.column.index === 2) {
        const catLabel = String(data.cell.raw);
        const catEntry = Object.entries(CATEGORIES).find(([, def]) => def.label === catLabel);
        if (catEntry) {
          const [r, g, b] = hexToRgb(catEntry[1].color);
          const isAlt = data.row.index % 2 === 1;
          doc.setFillColor(...(isAlt ? P.card : P.bg));
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(r, g, b);
          doc.text(catLabel, data.cell.x + 3, data.cell.y + data.cell.height / 2, { baseline: "middle" as const });
        }
      }

      // % of Total column (idx 5) → progress bar
      if (data.column.index === 5) {
        const rawStr = String(data.cell.raw);
        const pct = parseFloat(rawStr);
        if (isNaN(pct)) return;
        const isAlt = data.row.index % 2 === 1;
        doc.setFillColor(...(isAlt ? P.card : P.bg));
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
        const barColor: C = isAlt ? [51, 31, 92] : [44, 24, 82];
        const maxBarW = data.cell.width - 6;
        const barW = Math.max(0.5, (pct / 100) * maxBarW);
        doc.setFillColor(...barColor);
        doc.rect(data.cell.x + 3, data.cell.y + 1.8, barW, data.cell.height - 3.6, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...P.body);
        doc.text(rawStr, data.cell.x + 3, data.cell.y + data.cell.height / 2, { baseline: "middle" as const });
      }
    },
  });

  doc.save(`Klokrs-export-${fromDate}-to-${toDate}.pdf`);
}

type ExportRange = "today" | "week" | "month" | "custom";

interface ExportPreview {
  days: number;
  totalSessions: number;
  totalSeconds: number;
}

interface RawSession {
  date: string;
  domain: string;
  duration_seconds: number;
  visits: number;
}

function dateRangeForPreset(preset: Exclude<ExportRange, "custom">): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const to = fmt(today);
  if (preset === "today") return { from: to, to };
  if (preset === "week") {
    const d = new Date(today); d.setDate(d.getDate() - 6);
    return { from: fmt(d), to };
  }
  const d = new Date(today); d.setDate(d.getDate() - 29);
  return { from: fmt(d), to };
}

/* ─── Tab definitions ────────────────────────────────────── */

const TABS = [
  {
    id: "general",
    label: "General",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    id: "security",
    label: "Security",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    id: "ai",
    label: "AI Keys",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10c0-1.5-.3-2.9-.9-4.2" /><path d="M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7v.5" /><line x1="12" y1="17" x2="12" y2="17.01" />
      </svg>
    ),
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
  {
    id: "data",
    label: "Data",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    id: "billing",
    label: "Billing",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ─── Page ───────────────────────────────────────────────── */

export default function SettingsPage() {
  return (
    <Suspense fallback={<AppShell title="Settings"><Loader /></AppShell>}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("general");

  // Deep-link support, e.g. /dashboard/settings?tab=preferences (used by
  // the AI "Configure key" link and the onboarding tour).
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab as TabId);
  }, [searchParams]);

  const [displayName, setDisplayName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const [prefs, setPrefs] = useState<KlokrsPrefs>(DEFAULT_PREFS);
  const prefsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [exportRange, setExportRange] = useState<ExportRange>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Diagnostics tab state
  const [diagData, setDiagData] = useState<DiagnosticsData | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagForceSyncing, setDiagForceSyncing] = useState(false);
  const [diagClearConfirm, setDiagClearConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const { session: authSession } = useAuthSession();

  // Sync auth session → local user state so handlers can update metadata after rename.
  useEffect(() => {
    if (!authSession) return;
    setUser(authSession.user);
    setDisplayName(authSession.user.user_metadata?.full_name ?? "");
    setLoading(false);
  }, [authSession]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      // Try loading from Supabase first; fall back to localStorage.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch("/api/prefs", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const json = await res.json() as { prefs: KlokrsPrefs };
            setPrefs(json.prefs);
            try { window.postMessage({ type: "Klokrs_PREFS", prefs: json.prefs }, window.location.origin); } catch { /* no ext */ }
            return;
          }
        }
      } catch { /* fall through */ }
      const loaded = loadPrefs();
      setPrefs(loaded);
      try { window.postMessage({ type: "Klokrs_PREFS", prefs: loaded }, window.location.origin); } catch { /* no extension */ }
    })();
  }, []);

  const handleSaveName = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) { toast.error("Name cannot be empty."); return; }
    setNameSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
    setNameSaving(false);
    if (error) { toast.error(error.message); return; }
    setUser((u) => u ? { ...u, user_metadata: { ...u.user_metadata, full_name: trimmed } } : u);
    toast.success("Name updated.");
  };

  const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
  const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  const handleAvatarSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !user) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Please choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be smaller than 3MB.");
      return;
    }

    setAvatarUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      if (updateError) throw updateError;

      // Best-effort cleanup of the previous avatar file so storage doesn't accumulate.
      const prevUrl = user.user_metadata?.avatar_url as string | undefined;
      if (prevUrl) {
        const marker = "/avatars/";
        const idx = prevUrl.indexOf(marker);
        if (idx !== -1) {
          const prevPath = prevUrl.slice(idx + marker.length);
          if (prevPath && prevPath !== path) {
            void supabase.storage.from("avatars").remove([prevPath]);
          }
        }
      }

      setUser((u) => u ? { ...u, user_metadata: { ...u.user_metadata, avatar_url: avatarUrl } } : u);
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!user) return;
    setAvatarUploading(true);
    try {
      const supabase = createClient();
      const prevUrl = user.user_metadata?.avatar_url as string | undefined;
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (error) throw error;
      if (prevUrl) {
        const marker = "/avatars/";
        const idx = prevUrl.indexOf(marker);
        if (idx !== -1) void supabase.storage.from("avatars").remove([prevUrl.slice(idx + marker.length)]);
      }
      setUser((u) => u ? { ...u, user_metadata: { ...u.user_metadata, avatar_url: null } } : u);
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const updatePrefs = (patch: Partial<KlokrsPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      // Push to extension immediately.
      try { window.postMessage({ type: "Klokrs_PREFS", prefs: next }, window.location.origin); } catch { /* no ext */ }
      // Debounce Supabase POST — fires 800ms after the last change.
      if (prefsSyncTimer.current) clearTimeout(prefsSyncTimer.current);
      prefsSyncTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await fetch("/api/prefs", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ prefs: next }),
              });
            }
          } catch { /* silent — localStorage already saved */ }
        })();
      }, 800);
      if (prefsToastTimer.current) clearTimeout(prefsToastTimer.current);
      prefsToastTimer.current = setTimeout(() => toast.success("Preferences saved."), 800);
      return next;
    });
  };

  const handleChangePassword = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Use at least 8 characters."); return; }
    if (password !== passwordConfirm) { toast.error("Passwords do not match."); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setPassword(""); setPasswordConfirm("");
    toast.success("Password updated.");
  };

  const getDateRange = (): { from: string; to: string } | null => {
    if (exportRange === "custom") {
      if (!customFrom || !customTo || customFrom > customTo) return null;
      return { from: customFrom, to: customTo };
    }
    return dateRangeForPreset(exportRange);
  };

  const handlePreview = async () => {
    if (!user) return;
    const range = getDateRange();
    if (!range) { toast.error("Please set a valid date range."); return; }
    setPreviewing(true);
    setPreview(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("date, domain, duration_seconds, visits")
      .eq("user_id", user.id)
      .gte("date", range.from)
      .lte("date", range.to);
    setPreviewing(false);
    if (error || !data) { toast.error("Failed to fetch preview."); return; }
    const rows = data as RawSession[];
    const days = new Set(rows.map((r) => r.date)).size;
    const totalSessions = rows.length;
    const totalSeconds = rows.reduce((s, r) => s + r.duration_seconds, 0);
    setPreview({ days, totalSessions, totalSeconds });
  };

  const handleExport = async () => {
    if (!user) return;
    const range = getDateRange();
    if (!range) { toast.error("Please set a valid date range."); return; }
    setExporting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("date, domain, duration_seconds, visits")
      .eq("user_id", user.id)
      .gte("date", range.from)
      .lte("date", range.to)
      .order("date", { ascending: false })
      .order("duration_seconds", { ascending: false });
    setExporting(false);
    if (error || !data) { toast.error("Export failed: " + (error?.message ?? "no data")); return; }
    const rows = data as RawSession[];
    if (rows.length === 0) { toast.error("No data in this range."); return; }

    // Aggregate by date + root domain → one summary row per domain per day
    const map = new Map<string, { date: string; domain: string; totalSeconds: number; visits: number }>();
    for (const r of rows) {
      const key = `${r.date}__${r.domain}`;
      const cur = map.get(key) ?? { date: r.date, domain: r.domain, totalSeconds: 0, visits: 0 };
      cur.totalSeconds += r.duration_seconds;
      cur.visits += r.visits ?? 1;
      map.set(key, cur);
    }
    const summary = Array.from(map.values()).sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.totalSeconds - a.totalSeconds
    );

    const totalSeconds = summary.reduce((s, r) => s + r.totalSeconds, 0);
    generateExportPdf(
      summary,
      range.from,
      range.to,
      user.email ?? "",
      { days: new Set(summary.map((r) => r.date)).size, totalSeconds },
      prefs.categoryOverrides,
    );
    toast.success(`Exported ${summary.length} rows.`);
  };

  const loadDiagnostics = async () => {
    if (!user) return;
    setDiagLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error("Not authenticated."); setDiagLoading(false); return; }

      const res = await fetch("/api/diagnostics", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load diagnostics."); setDiagLoading(false); return; }
      const api = await res.json() as DiagnosticsApiResponse;

      // Extension client-side data arrives via window.postMessage; we read
      // from localStorage as a fallback since the extension may not be present.
      const storedPrefs = loadPrefs();
      const workHours = `${String(storedPrefs.workStartHour).padStart(2, "0")}:00–${String(storedPrefs.workEndHour).padStart(2, "0")}:00`;

      setDiagData({
        connected: api.connected,
        lastDbWrite: api.last_db_write,
        sessionsToday: api.sessions_today,
        pendingWrites: 0,       // populated below if extension responds
        lastSyncTs: null,       // populated below if extension responds
        lastSyncStatus: null,   // populated below if extension responds
        extensionVersion: null, // populated below if extension responds
        browser: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1]
          ? `Chrome ${navigator.userAgent.match(/Chrome\/([\d.]+)/)![1]}`
          : navigator.userAgent,
        accountId: api.user_id,
        accountCreatedAt: api.account_created_at,
        idleTimeoutMinutes: storedPrefs.idleTimeoutMinutes,
        minSessionSeconds: storedPrefs.minSessionSeconds,
        workHours,
      });
    } catch {
      toast.error("Failed to load diagnostics.");
    }
    setDiagLoading(false);
  };

  const handleForceSyncMessage = () => {
    setDiagForceSyncing(true);
    window.postMessage({ type: "Klokrs_FORCE_SYNC" }, window.location.origin);
    setTimeout(() => {
      setDiagForceSyncing(false);
      toast.success("Force sync triggered.");
      void loadDiagnostics();
    }, 2500);
  };

  const handleClearCache = () => {
    if (!diagClearConfirm) { setDiagClearConfirm(true); return; }
    window.postMessage({ type: "Klokrs_CLEAR_CACHE" }, window.location.origin);
    setDiagClearConfirm(false);
    toast.success("Cache clear requested. Extension will reload tracking state.");
  };

  const handleExportDiagnosticsJson = () => {
    if (!diagData) return;
    const manifest = { manifest_version: 3, permissions: ["tabs","idle","storage","alarms","activeTab"] };
    const report = {
      exported_at: new Date().toISOString(),
      user: {
        account_id: diagData.accountId,
        created_at: diagData.accountCreatedAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      extension: {
        version: diagData.extensionVersion ?? "unknown",
        manifest_version: manifest.manifest_version,
        permissions: manifest.permissions,
      },
      browser: { name: "Chrome", version: diagData.browser },
      sync: {
        last_success: diagData.lastSyncStatus === "ok" && diagData.lastSyncTs
          ? new Date(diagData.lastSyncTs).toISOString()
          : null,
        last_attempt: diagData.lastSyncTs ? new Date(diagData.lastSyncTs).toISOString() : null,
        pending_writes: diagData.pendingWrites,
        total_sessions_today: diagData.sessionsToday,
        last_db_write: diagData.lastDbWrite,
        connected: diagData.connected,
      },
      settings: {
        idle_timeout_minutes: diagData.idleTimeoutMinutes,
        min_session_seconds: diagData.minSessionSeconds,
        work_hours: diagData.workHours,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klokrs-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Diagnostics report downloaded.");
  };

  if (loading) {
    return (
      <AppShell title="Settings" contentMaxClassName="max-w-4xl">
        <Loader />
      </AppShell>
    );
  }

  // Convert integer hour (0-23) to HH:MM string for <input type="time">.
  const hourToTimeStr = (h: number) => `${String(h).padStart(2, "0")}:00`;
  // Parse HH:MM back to integer hour.
  const timeStrToHour = (s: string) => parseInt(s.split(":")[0] ?? "0", 10);

  return (
    <AppShell title="Settings" contentMaxClassName="max-w-4xl">
      <PageHeader eyebrow="Account" title="Settings" />

      {/* Tab bar — two rows on mobile (4+3), single row on lg */}
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 lg:grid-cols-7">
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-all duration-150 sm:gap-2 sm:px-3 ${
                isActive
                  ? "bg-violet-600/25 text-violet-200 shadow-sm"
                  : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
              }`}
            >
              <span className={`shrink-0 ${isActive ? "text-violet-300/80" : "text-white/30"}`}>
                {t.icon}
              </span>
              <span className="hidden truncate sm:block">{t.label}</span>
              {isActive && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className="absolute inset-0 rounded-xl border border-violet-500/20"
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="space-y-5"
        >

          {/* ── General ── */}
          {activeTab === "general" && (
            <>
              <div>
                <SectionTitle tooltip="Your display name and photo shown in the dashboard greeting.">Profile</SectionTitle>
                <Card>
                  <div className="flex items-center gap-4 py-4">
                    <div className="relative shrink-0">
                      {user?.user_metadata?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.user_metadata.avatar_url as string}
                          alt="Your profile photo"
                          className="h-16 w-16 rounded-full border border-white/[0.14] object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.14] bg-gradient-to-br from-violet-500 to-cyan-600 text-lg font-semibold text-white"
                          aria-hidden
                        >
                          {(displayName || user?.email || "?").trim().slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {avatarUploading && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                          <div
                            className="h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white"
                            role="status"
                            aria-label="Uploading photo"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] disabled:opacity-40"
                        >
                          {user?.user_metadata?.avatar_url ? "Change photo" : "Upload photo"}
                        </button>
                        {user?.user_metadata?.avatar_url && (
                          <button
                            type="button"
                            onClick={() => void handleAvatarRemove()}
                            disabled={avatarUploading}
                            className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] disabled:opacity-40"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-white/35">PNG, JPEG, WebP, or GIF. Max 3MB.</p>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => void handleAvatarSelect(e)}
                        className="hidden"
                      />
                    </div>
                  </div>
                  <form onSubmit={handleSaveName} className="py-3 space-y-4 max-w-sm border-t border-white/[0.05]">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-white/50">Full name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                      />
                    </div>
                    <Button type="submit" disabled={nameSaving} variant="primary">
                      {nameSaving ? "Saving…" : "Save name"}
                    </Button>
                  </form>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Your Klokrs account details. Tab data is tied to this email address.">Account</SectionTitle>
                <Card>
                  <PrefRow label="Email">
                    <span className="text-sm text-white/70 break-all">{user?.email ?? "—"}</span>
                  </PrefRow>
                  <PrefRow label="User ID" hint="Unique identifier for your account">
                    <span className="font-mono text-xs text-white/35 break-all">{user?.id ?? "—"}</span>
                  </PrefRow>
                  <PrefRow label="Joined" hint="Account creation date">
                    <span className="text-sm text-white/55">
                      {user?.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "—"}
                    </span>
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Your time zone controls how 'today' is calculated for the dashboard and reports. Defaults to your browser's time zone if not overridden.">Time zone</SectionTitle>
                <Card>
                  <PrefRow
                    label="Time zone"
                    hint={
                      prefs.timezone
                        ? `Saved: ${prefs.timezone} (${getTzOffsetLabel(prefs.timezone)})`
                        : `Auto-detected: ${resolveTimezone(prefs)} (${getTzOffsetLabel(resolveTimezone(prefs))})`
                    }
                  >
                    <select
                      value={prefs.timezone ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        updatePrefs({ timezone: v === "" ? null : v });
                      }}
                      className="w-full max-w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition-colors hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] focus:border-violet-500/50 [color-scheme:dark] sm:max-w-[16rem]"
                    >
                      <option value="">
                        Auto-detect ({resolveTimezone(prefs)}, {getTzOffsetLabel(resolveTimezone(prefs))})
                      </option>
                      {(() => {
                        let zones: string[] = [];
                        try {
                          const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
                          if (typeof fn === "function") zones = fn("timeZone");
                        } catch { /* ignore */ }
                        if (zones.length === 0) {
                          zones = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Karachi", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];
                        }
                        return zones.map((z) => (
                          <option key={z} value={z}>
                            {z} ({getTzOffsetLabel(z)})
                          </option>
                        ));
                      })()}
                    </select>
                  </PrefRow>
                  <PrefRow label="Local time now">
                    <span className="text-sm text-white/55 tabular-nums">
                      {new Date().toLocaleString("en-US", {
                        timeZone: resolveTimezone(prefs),
                        hour: "2-digit", minute: "2-digit", hour12: false,
                        weekday: "short", month: "short", day: "numeric",
                      })}
                    </span>
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Steps to get the Chrome extension working correctly with your account.">Extension setup</SectionTitle>
                <Card>
                  <div className="py-3 space-y-3">
                    {[
                      "Keep this tab signed in so the extension can read your auth session.",
                      "Pin the Klokrs icon from your Chrome extensions menu for quick access.",
                      "Browse in a normal window (not Incognito) for sessions to be tracked.",
                      "The extension syncs every ~60 seconds and when you switch tabs.",
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-white/50">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-300">
                          {i + 1}
                        </span>
                        {tip}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* ── Security ── */}
          {activeTab === "security" && (
            <div>
              <SectionTitle tooltip="Change your Klokrs login password. Must be at least 8 characters.">Password</SectionTitle>
              <Card>
                <form onSubmit={handleChangePassword} className="py-3 space-y-4 max-w-sm">
                  <PasswordInput
                    label="New password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                  />
                  <PasswordInput
                    label="Confirm new password"
                    value={passwordConfirm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                  <Button type="submit" disabled={saving} variant="primary">
                    {saving ? "Saving…" : "Update password"}
                  </Button>
                </form>
              </Card>
            </div>
          )}

          {/* ── Preferences ── */}
          {activeTab === "preferences" && (
            <>
              <div data-tour="productivity-threshold">
                <SectionTitle tooltip="Define what a productive day looks like — used to colour the Activity heatmap and calculate your streak.">Productivity</SectionTitle>
                <Card>
                  <PrefRow
                    label="Productive day threshold"
                    hint="Days where you track at least this many hours are marked productive on the Activity heatmap"
                  >
                    <ChipSelect
                      options={[2, 3, 4, 5, 6, 7, 8, 10, 12] as number[]}
                      value={prefs.productiveHoursThreshold}
                      format={(v) => `${v as number}h`}
                      onChange={(v) => updatePrefs({ productiveHoursThreshold: v as number })}
                    />
                  </PrefRow>
                  <PrefRow label="Equivalent minutes">
                    <span className="text-sm text-white/40 tabular-nums">
                      {prefs.productiveHoursThreshold * 60} min / day
                    </span>
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Your typical workday window — used to calculate what percentage of working time was actively tracked.">Working hours</SectionTitle>
                <Card>
                  <PrefRow label="Day starts at">
                    <input
                      type="time"
                      value={hourToTimeStr(prefs.workStartHour)}
                      onChange={(e) => updatePrefs({ workStartHour: timeStrToHour(e.target.value) })}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
                    />
                  </PrefRow>
                  <PrefRow label="Day ends at">
                    <input
                      type="time"
                      value={hourToTimeStr(prefs.workEndHour)}
                      onChange={(e) => updatePrefs({ workEndHour: timeStrToHour(e.target.value) })}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
                    />
                  </PrefRow>
                  <PrefRow label="Effective window">
                    <span className="text-sm text-white/40 tabular-nums">
                      {((prefs.workEndHour - prefs.workStartHour + 24) % 24) || 24}h per day
                    </span>
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Fine-tune how the extension counts sessions. Changes apply immediately to the running extension.">Tracking</SectionTitle>
                <Card>
                  <PrefRow label="Minimum session duration" hint="Sessions shorter than this are ignored">
                    <ChipSelect
                      options={[1, 3, 5, 10, 15, 30, 60] as number[]}
                      value={prefs.minSessionSeconds}
                      format={(v) => `${v as number}s`}
                      onChange={(v) => updatePrefs({ minSessionSeconds: v as number })}
                    />
                  </PrefRow>
                  <PrefRow label="Idle timeout" hint="Mark session idle after this long without activity">
                    <ChipSelect
                      options={[1, 2, 5, 10, 15, 30] as number[]}
                      value={prefs.idleTimeoutMinutes}
                      format={(v) => `${v as number}m`}
                      onChange={(v) => updatePrefs({ idleTimeoutMinutes: v as number })}
                    />
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="When a scheduled task's window ends and you spent at least this much of it on the task's tagged domains, the task closes itself. The Daily Planner also surfaces unscheduled stretches of activity as red Background-activity blocks you can assign or dismiss.">Daily Planner</SectionTitle>
                <Card>
                  <PrefRow
                    label="Auto-complete tasks"
                    hint="When on, scheduled tasks flip to done at the end of their window if you hit the threshold"
                  >
                    <Toggle
                      checked={prefs.autoCompleteEnabled}
                      onChange={(v) => updatePrefs({ autoCompleteEnabled: v })}
                    />
                  </PrefRow>
                  <PrefRow
                    label="Completion threshold"
                    hint="% of the window that must be spent on the task's tagged domains"
                  >
                    <ChipSelect
                      options={[50, 60, 70, 75, 80, 85, 90, 95] as number[]}
                      value={prefs.autoCompleteThreshold}
                      format={(v) => `${v as number}%`}
                      onChange={(v) => updatePrefs({ autoCompleteThreshold: v as number })}
                    />
                  </PrefRow>
                  <PrefRow
                    label="Background-activity minimum gap"
                    hint="Unscheduled stretches longer than this surface as red blocks"
                  >
                    <ChipSelect
                      options={[5, 10, 15, 20, 30, 45, 60] as number[]}
                      value={prefs.redBlockMinGapMinutes}
                      format={(v) => `${v as number}m`}
                      onChange={(v) => updatePrefs({ redBlockMinGapMinutes: v as number })}
                    />
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Desktop notifications from the Klokrs Chrome extension. Browser must allow notifications for klokrs.com / the extension.">Notifications</SectionTitle>
                <Card>
                  <PrefRow
                    label="Day started"
                    hint={`Notify me when my work day begins (${String(prefs.workStartHour).padStart(2, "0")}:00)`}
                  >
                    <Toggle
                      checked={prefs.notifications.dayStart}
                      onChange={(v) => updatePrefs({ notifications: { ...prefs.notifications, dayStart: v } })}
                    />
                  </PrefRow>
                  <PrefRow
                    label="Day complete"
                    hint={`Notify me with today's recap when my work day ends (${String(prefs.workEndHour).padStart(2, "0")}:00)`}
                  >
                    <Toggle
                      checked={prefs.notifications.dayComplete}
                      onChange={(v) => updatePrefs({ notifications: { ...prefs.notifications, dayComplete: v } })}
                    />
                  </PrefRow>
                </Card>
              </div>
            </>
          )}

          {/* ── Data ── */}
          {activeTab === "data" && (
            <>
              <div>
                <SectionTitle tooltip="Download your browsing data as a branded PDF — one row per domain per day with time spent and visit count.">Export data</SectionTitle>
                <Card>
                  {/* Range presets */}
                  <PrefRow label="Date range" hint="Choose a preset or set a custom window">
                    <ChipSelect
                      options={["today", "week", "month", "custom"] as ExportRange[]}
                      value={exportRange}
                      format={(v) => v === "today" ? "Today" : v === "week" ? "Last 7 days" : v === "month" ? "Last 30 days" : "Custom"}
                      onChange={(v) => { setExportRange(v); setPreview(null); }}
                    />
                  </PrefRow>

                  {/* Custom date pickers */}
                  {exportRange === "custom" && (() => {
                    const joinedAt = user?.created_at ? user.created_at.slice(0, 10) : "2020-01-01";
                    const todayStr = new Date().toISOString().slice(0, 10);
                    return (
                      <div className="flex flex-wrap items-center gap-3 py-3.5 border-b border-white/[0.05]">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white/40 shrink-0">From</label>
                          <input
                            type="date"
                            value={customFrom}
                            min={joinedAt}
                            max={customTo || todayStr}
                            onChange={(e) => { setCustomFrom(e.target.value); setPreview(null); }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white/40 shrink-0">To</label>
                          <input
                            type="date"
                            value={customTo}
                            min={customFrom || joinedAt}
                            max={todayStr}
                            onChange={(e) => { setCustomTo(e.target.value); setPreview(null); }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Preview + download row */}
                  <div className="py-4 flex flex-col gap-4">

                    {/* Preview banner */}
                    {preview && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/60 mb-2">Export preview</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-1">
                          <div>
                            <p className="text-xl font-bold text-white tabular-nums">{preview.days}</p>
                            <p className="text-xs text-white/40">{preview.days === 1 ? "day" : "days"}</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-white tabular-nums">{preview.totalSessions}</p>
                            <p className="text-xs text-white/40">sessions</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold tabular-nums" style={{ color: "#7C3AED" }}>{formatDuration(preview.totalSeconds)}</p>
                            <p className="text-xs text-white/40">total tracked</p>
                          </div>
                        </div>
                        {preview.totalSessions === 0 && (
                          <p className="mt-2 text-xs text-amber-400/70">No data in this range.</p>
                        )}
                      </motion.div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Preview button */}
                      <button
                        type="button"
                        onClick={() => void handlePreview()}
                        disabled={previewing}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/60 hover:border-white/20 hover:text-white/90 transition-all disabled:opacity-40"
                      >
                        {previewing ? (
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
                          </svg>
                        )}
                        {previewing ? "Checking…" : "Preview"}
                      </button>

                      {/* Download button */}
                      <button
                        type="button"
                        onClick={() => void handleExport()}
                        disabled={exporting || (preview?.totalSessions === 0)}
                        className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600/20 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-600/35 hover:border-violet-500/50 transition-all disabled:opacity-40"
                      >
                        {exporting ? (
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        )}
                        {exporting ? "Exporting…" : "Download PDF"}
                      </button>
                    </div>
                  </div>
                </Card>
              </div>

              {/* What we store */}
              <div>
                <SectionTitle tooltip="A summary of exactly what data Klokrs records — and what it never touches.">What we store</SectionTitle>
                <Card>
                  <div className="py-3 space-y-0 divide-y divide-white/[0.05]">
                    {[
                      { label: "Domain name", detail: "e.g. youtube.com — never the full URL or path" },
                      { label: "Time spent", detail: "Duration in seconds, aggregated per session" },
                      { label: "Visit count", detail: "Number of times you navigated to that domain" },
                      { label: "Date", detail: "Local date of the session (not UTC)" },
                    ].map(({ label, detail }) => (
                      <div key={label} className="flex items-start justify-between gap-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-400/60 shrink-0 mt-1.5" />
                          <span className="text-sm text-white/75">{label}</span>
                        </div>
                        <span className="text-xs text-white/35 text-right">{detail}</span>
                      </div>
                    ))}
                    <div className="pt-3 text-xs text-white/30 leading-relaxed">
                      No page content, keystrokes, URLs, or personal information is ever collected or stored.
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* ── Diagnostics ── */}
          {/* ── AI Keys ── */}
          {activeTab === "ai" && <AiSettingsTab />}

          {/* ── Billing ── */}
          {activeTab === "billing" && <BillingCard />}

          {activeTab === "diagnostics" && (
            <>
              {/* Connection & sync status */}
              <div>
                <SectionTitle tooltip="Live connection and sync health pulled from the server and your local extension state.">Connection Status</SectionTitle>
                <Card>
                  {diagLoading && (
                    <div className="py-6 flex justify-center"><Loader /></div>
                  )}
                  {!diagLoading && !diagData && (
                    <div className="py-5 text-center">
                      <p className="text-sm text-white/40 mb-4">Load diagnostics to see current status.</p>
                      <button
                        type="button"
                        onClick={() => void loadDiagnostics()}
                        className="rounded-xl border border-violet-500/30 bg-violet-600/20 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-600/35 transition-all"
                      >
                        Load Diagnostics
                      </button>
                    </div>
                  )}
                  {!diagLoading && diagData && (
                    <>
                      <PrefRow label="Status">
                        <span className={`flex items-center gap-2 text-sm font-medium ${diagData.connected ? "text-emerald-400" : "text-red-400"}`}>
                          <span className={`h-2 w-2 rounded-full ${diagData.connected ? "bg-emerald-400" : "bg-red-400"}`} />
                          {diagData.connected ? "Connected" : "Disconnected"}
                        </span>
                      </PrefRow>
                      <PrefRow label="Last successful sync" hint="Most recent write recorded in the database">
                        <span className="text-sm text-white/55 tabular-nums">
                          {diagData.lastDbWrite
                            ? new Date(diagData.lastDbWrite).toLocaleString()
                            : "No writes yet"}
                        </span>
                      </PrefRow>
                      <PrefRow label="Sessions today" hint="Total sessions recorded today in the database">
                        <span className="text-sm text-white/70 tabular-nums">{diagData.sessionsToday}</span>
                      </PrefRow>
                      <PrefRow label="Extension version">
                        <span className="text-sm text-white/55">{diagData.extensionVersion ?? "Not detected"}</span>
                      </PrefRow>
                      <PrefRow label="Browser">
                        <span className="text-sm text-white/55 break-all">{diagData.browser}</span>
                      </PrefRow>
                      <PrefRow label="Account ID" hint="Share this with support if you need help">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white/35 break-all">{diagData.accountId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(diagData.accountId);
                              setCopiedId(true);
                              setTimeout(() => setCopiedId(false), 2000);
                            }}
                            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
                          >
                            {copiedId ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </PrefRow>
                    </>
                  )}
                </Card>
              </div>

              {/* Actions */}
              {diagData && (
                <div>
                  <SectionTitle tooltip="Maintenance actions for your local extension state.">Actions</SectionTitle>
                  <Card>
                    <div className="py-3 flex flex-col gap-3">
                      {/* Force sync */}
                      <div className="flex items-center justify-between gap-4 py-1">
                        <div>
                          <p className="text-sm text-white/80">Force sync now</p>
                          <p className="mt-0.5 text-xs text-white/35">Triggers an immediate heartbeat from the extension</p>
                        </div>
                        <button
                          type="button"
                          disabled={diagForceSyncing}
                          onClick={handleForceSyncMessage}
                          className="shrink-0 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/60 hover:border-white/20 hover:text-white/90 transition-all disabled:opacity-40"
                        >
                          {diagForceSyncing ? (
                            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                          )}
                          {diagForceSyncing ? "Syncing…" : "Sync now"}
                        </button>
                      </div>

                      {/* Clear cache */}
                      <div className="flex items-center justify-between gap-4 py-1 border-t border-white/[0.05] pt-3">
                        <div>
                          <p className="text-sm text-white/80">Clear local cache</p>
                          <p className="mt-0.5 text-xs text-white/35">Wipes session state and retry queue. Auth tokens are preserved.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearCache}
                          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                            diagClearConfirm
                              ? "border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                              : "border border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20 hover:text-white/90"
                          }`}
                        >
                          {diagClearConfirm ? "Confirm clear" : "Clear cache"}
                        </button>
                      </div>

                      {/* Export JSON */}
                      <div className="flex items-center justify-between gap-4 py-1 border-t border-white/[0.05] pt-3">
                        <div>
                          <p className="text-sm text-white/80">Export diagnostics report</p>
                          <p className="mt-0.5 text-xs text-white/35">Downloads a JSON file you can paste in a support email</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportDiagnosticsJson}
                          className="shrink-0 flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-600/35 hover:border-violet-500/50 transition-all"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Export JSON
                        </button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Refresh button when data is loaded */}
              {diagData && !diagLoading && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void loadDiagnostics()}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    ↻ Refresh diagnostics
                  </button>
                </div>
              )}
            </>
          )}

        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
