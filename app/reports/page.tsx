"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuthSession } from "@/lib/useAuthSession";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Loader } from "@/components/ui/Loader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportsDomainTable } from "@/components/reports/ReportsDomainTable";
import { DomainDrilldownModal } from "@/components/reports/DomainDrilldownModal";
import { getSiteName } from "@/lib/domain";
import { loadPrefs, savePrefs, getLocalDateString, type KlokrsPrefs } from "@/lib/prefs";
import {
  getCategoryForDomain,
  getCategoryStats,
  CATEGORIES,
  hexToRgb,
  type CategoryId,
} from "@/lib/categories";

// ─── Types ────────────────────────────────────────────────────

type Tab = "daily" | "weekly" | "monthly";

interface ByDate {
  date: string;
  total_seconds: number;
}

interface ByDomain {
  domain: string;
  total_seconds: number;
  visit_count: number;
  percentage_of_total: number;
}

interface ReportData {
  by_date: ByDate[];
  by_domain: ByDomain[];
}

interface HourRow {
  hour: number;
  minutes: number;
}

interface DrillTarget {
  domain: string;
  totalSeconds: number;
}

// ─── Helpers ──────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// Every date-navigation helper below (localDateStr, getMonday, addDays, the
// prev/next handlers) decodes/encodes Date objects via *local* getters —
// that's fine and self-consistent for calendar math (prev day, start of
// week, …), but means the one Date that has to be seeded from *outside* this
// closed local-getter system — "today" — must be resolved against the
// user's stored prefs.timezone, not the browser's own clock, or every
// derived value here (initial selected day, "is this the current period"
// comparisons, the Today button) silently drifts from what the rest of the
// dashboard considers "today" whenever the two zones differ.
//
// Constructing via the local Date constructor from resolveTodayDateString()'s
// Y/M/D (rather than parsing it as a UTC instant) is deliberate: it makes
// this anchor decode back to the exact same Y/M/D through every *local*-
// getter-based helper in this file, regardless of what the runtime's own
// timezone happens to be — the string is the source of truth, this Date is
// just a vessel for feeding it into the existing local-getter calendar math.
function dateFromDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function resolveTodayAnchor(prefs: KlokrsPrefs): Date {
  return dateFromDateString(getLocalDateString(prefs));
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Chart tooltip ────────────────────────────────────────────

const ChartTooltip = ({
  active,
  payload,
  label,
  unit = "h",
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
  unit?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f0f16]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="text-base font-bold text-white">
        {payload[0]?.value ?? 0}
        {unit}
      </p>
    </div>
  );
};

// ─── PDF helpers ──────────────────────────────────────────────

type C = [number, number, number];
const PDF_C = {
  bg:     [10,  10,  15]  as C,
  violet: [124, 58,  237] as C,
  cyan:   [6,   182, 212] as C,
  card:   [17,  17,  24]  as C,
  border: [31,  31,  46]  as C,
  body:   [226, 232, 240] as C,
  muted:  [100, 116, 139] as C,
  white:  [255, 255, 255] as C,
};

interface PdfChartPoint {
  label: string;
  value: number;
}

interface PdfCategoryStat {
  label: string;
  color: string;
  seconds: number;
}

function drawSectionHeader(
  doc: jsPDF,
  label: string,
  subLabel: string,
  x: number,
  y: number,
  pageW: number,
  M: number
) {
  doc.setFillColor(...PDF_C.violet);
  doc.rect(x, y - 3.5, 1.2, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_C.cyan);
  doc.text(label, x + 3.5, y);
  if (subLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_C.muted);
    doc.text(subLabel, pageW - M, y, { align: "right" });
  }
}

function drawBarChart(
  doc: jsPDF,
  points: PdfChartPoint[],
  unit: "h" | "m",
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (points.length === 0) return;

  const axisX = x + 9;
  const axisY = y + h;
  const chartW = w - 9;

  const maxVal = Math.max(...points.map((p) => p.value), 0.01);

  // Chart card background
  doc.setFillColor(17, 17, 24);
  doc.roundedRect(x, y - 2, w, h + 8, 1.5, 1.5, "F");
  doc.setDrawColor(31, 31, 46);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y - 2, w, h + 8, 1.5, 1.5, "D");

  // Horizontal gridlines + Y-axis tick labels
  const ticks = 3;
  for (let t = 1; t <= ticks; t++) {
    const gy = axisY - (t / ticks) * h;
    doc.setDrawColor(31, 31, 46);
    doc.setLineWidth(0.2);
    doc.line(axisX, gy, axisX + chartW, gy);

    const tickVal = ((maxVal * t) / ticks).toFixed(1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...PDF_C.muted);
    doc.text(`${tickVal}${unit}`, axisX - 1.5, gy, { align: "right", baseline: "middle" as const });
  }

  // Y-axis line
  doc.setDrawColor(44, 44, 58);
  doc.setLineWidth(0.3);
  doc.line(axisX, y - 2, axisX, axisY);

  // X-axis line
  doc.line(axisX, axisY, axisX + chartW, axisY);

  // Bars
  const n = points.length;
  const gapFraction = n > 20 ? 0.15 : 0.22;
  const totalGaps = (n - 1) * chartW * gapFraction;
  const barW = Math.max(1, (chartW - totalGaps / n * (n - 1)) / n);
  const gap = n > 1 ? (chartW - barW * n) / (n - 1) : 0;

  for (let i = 0; i < n; i++) {
    const bx = axisX + i * (barW + gap);
    const barH = (points[i]!.value / maxVal) * h;

    if (barH > 0.3) {
      // Gradient effect: top ~40% is cyan-tinted, bottom violet
      const splitY = axisY - barH * 0.55;
      doc.setFillColor(124, 58, 237);
      doc.rect(bx, axisY - barH, barW, barH, "F");
      // Lighter top accent
      doc.setFillColor(80, 120, 230);
      doc.rect(bx, axisY - barH, barW, barH * 0.35, "F");
    }

    // X-axis label — show every label for <= 12 points, else every other/5th
    const showLabel =
      n <= 12 || (n <= 24 && i % 6 === 0) || (n > 24 && (i === 0 || i % 5 === 4));
    if (showLabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(...PDF_C.muted);
      doc.text(String(points[i]!.label), bx + barW / 2, axisY + 3, {
        align: "center",
        baseline: "top" as const,
      });
    }
  }
}

function drawCategoryBars(
  doc: jsPDF,
  cats: PdfCategoryStat[],
  totalSeconds: number,
  x: number,
  y: number,
  w: number
): number {
  const maxSec = cats[0]?.seconds ?? 1;
  const rowH = 7.5;
  let cy = y;

  for (const cat of cats) {
    const pct = Math.round((cat.seconds / totalSeconds) * 100);
    const labelW = 28;
    const timeW = 20;
    const barAreaX = x + labelW;
    const barAreaW = w - labelW - timeW - 2;
    const barFillW = Math.max(1, (cat.seconds / maxSec) * barAreaW);

    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_C.muted);
    doc.text(cat.label, x, cy + rowH / 2, { baseline: "middle" as const });

    // Background track
    doc.setFillColor(22, 22, 32);
    doc.roundedRect(barAreaX, cy + 2, barAreaW, rowH - 4, 0.8, 0.8, "F");

    // Filled bar
    const [r, g, b] = hexToRgb(cat.color);
    doc.setFillColor(r, g, b);
    doc.roundedRect(barAreaX, cy + 2, barFillW, rowH - 4, 0.8, 0.8, "F");

    // Time + %
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_C.body);
    doc.text(formatTime(cat.seconds), x + w - timeW + 2, cy + rowH / 2, {
      baseline: "middle" as const,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_C.muted);
    doc.text(`${pct}%`, x + w, cy + rowH / 2, {
      align: "right",
      baseline: "middle" as const,
    });

    cy += rowH + 1;
  }

  return cy - y;
}

// ─── PDF generator (Reports) ──────────────────────────────────

function generatePdf(
  tab: Tab,
  label: string,
  startDate: string,
  stats: { title: string; value: string }[],
  domains: ByDomain[],
  chartData: PdfChartPoint[],
  chartUnit: "h" | "m",
  categoryStats: PdfCategoryStat[],
  userEmail: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;

  const fillBg = () => {
    doc.setFillColor(...PDF_C.bg);
    doc.rect(0, 0, pageW, pageH, "F");
  };
  fillBg();

  const _addPage = doc.addPage.bind(doc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).addPage = (...args: unknown[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (_addPage as any)(...args);
    fillBg();
    return r;
  };

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── 1. Header bar ──────────────────────────────────────────
  const hdrH = 20;
  doc.setFillColor(...PDF_C.violet);
  doc.rect(0, 0, pageW, hdrH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PDF_C.white);
  doc.text("Klokrs", M, 13.5);

  const tabCap = tab.charAt(0).toUpperCase() + tab.slice(1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${tabCap} Report  ·  ${label}`, pageW - M, 13.5, { align: "right" });

  // ── 2. Divider ─────────────────────────────────────────────
  doc.setDrawColor(56, 29, 104);
  doc.setLineWidth(0.4);
  doc.line(M, hdrH + 1, pageW - M, hdrH + 1);

  let y = hdrH + 9;

  // ── 3. Stats cards (4 in a row) ───────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_C.cyan);
  doc.text("OVERVIEW", M, y);
  y += 5;

  const statCount = Math.min(stats.length, 4);
  const gap = 3;
  const boxW = (pageW - M * 2 - gap * (statCount - 1)) / statCount;
  const boxH = 24;

  for (let i = 0; i < statCount; i++) {
    const bx = M + i * (boxW + gap);

    doc.setFillColor(...PDF_C.card);
    doc.roundedRect(bx, y, boxW, boxH, 1.5, 1.5, "F");
    doc.setDrawColor(...PDF_C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, boxH, 1.5, 1.5, "D");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_C.muted);
    doc.text(stats[i]!.title.toUpperCase(), bx + 4, y + 7);

    const valFontSize = stats[i]!.value.length > 8 ? 13 : 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(valFontSize);
    doc.setTextColor(...PDF_C.body);
    doc.text(stats[i]!.value, bx + 4, y + 17.5);

    doc.setFillColor(...PDF_C.violet);
    doc.rect(bx + 4, y + 20, 8, 0.6, "F");
  }
  y += boxH + 8;

  // ── 4. Bar chart ───────────────────────────────────────────
  const chartLabel =
    tab === "daily"
      ? "HOURLY ACTIVITY"
      : tab === "weekly"
      ? "DAILY BREAKDOWN"
      : "DAILY TREND";
  const chartSubLabel =
    tab === "daily" ? "minutes per hour" : "hours per day";

  drawSectionHeader(doc, chartLabel, chartSubLabel, M, y, pageW, M);
  y += 5;

  const chartH = 40;
  drawBarChart(doc, chartData, chartUnit, M, y, pageW - M * 2, chartH);
  y += chartH + 13;

  // ── 5. Category breakdown ─────────────────────────────────
  const topCats = categoryStats.slice(0, 7);
  if (topCats.length >= 2) {
    drawSectionHeader(doc, "BY CATEGORY", "time per activity type", M, y, pageW, M);
    y += 5;

    const totalCatSeconds = domains.reduce((s, d) => s + d.total_seconds, 0);
    const catRowsH = drawCategoryBars(
      doc,
      topCats,
      totalCatSeconds,
      M,
      y,
      pageW - M * 2
    );
    y += catRowsH + 6;
  }

  // ── 6. Domain table ────────────────────────────────────────
  drawSectionHeader(doc, "TIME BY DOMAIN", `${domains.length} domains ranked`, M, y, pageW, M);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    head: [["#", "Domain", "Category", "Total Time", "Visits", "% of Total"]],
    body: domains.map((d, i) => [
      String(i + 1),
      getSiteName(d.domain),
      CATEGORIES[getCategoryForDomain(d.domain)].label,
      formatTime(d.total_seconds),
      String(d.visit_count),
      `${d.percentage_of_total}%`,
    ]),
    columnStyles: {
      0: { cellWidth: 10, halign: "center" as const },
      1: { cellWidth: "auto" as const },
      2: { cellWidth: 26 },
      3: { cellWidth: 24, halign: "right" as const },
      4: { cellWidth: 17, halign: "right" as const },
      5: { cellWidth: 32 },
    },
    headStyles: {
      fillColor: PDF_C.violet,
      textColor: PDF_C.white,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor: PDF_C.bg,
      textColor: PDF_C.body,
      fontSize: 8.5,
      lineColor: PDF_C.border,
      lineWidth: 0.2,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: PDF_C.card },
    showHead: "everyPage",

    didDrawPage: () => {
      doc.setFillColor(...PDF_C.card);
      doc.rect(0, pageH - 12, pageW, 12, "F");
      doc.setDrawColor(...PDF_C.border);
      doc.setLineWidth(0.3);
      doc.line(0, pageH - 12, pageW, pageH - 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_C.muted);
      doc.text("Generated by Klokrs", M, pageH - 5);
      doc.text(userEmail, pageW / 2, pageH - 5, { align: "center" });
      doc.text(today, pageW - M, pageH - 5, { align: "right" });
    },

    didDrawCell: (data) => {
      if (data.section !== "body") return;

      // Row 0, Total Time column (idx 3) → repaint cyan bold
      if (data.row.index === 0 && data.column.index === 3) {
        const isAlt = false;
        doc.setFillColor(...(isAlt ? PDF_C.card : PDF_C.bg));
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...PDF_C.cyan);
        doc.text(
          String(data.cell.raw),
          data.cell.x + data.cell.width - 3,
          data.cell.y + data.cell.height / 2,
          { align: "right", baseline: "middle" as const }
        );
      }

      // Category column (idx 2) — colour the text to match category
      if (data.column.index === 2) {
        const catLabel = String(data.cell.raw);
        const catEntry = Object.entries(CATEGORIES).find(
          ([, def]) => def.label === catLabel
        );
        if (catEntry) {
          const [r, g, b] = hexToRgb(catEntry[1].color);
          const isAlt = data.row.index % 2 === 1;
          doc.setFillColor(...(isAlt ? PDF_C.card : PDF_C.bg));
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(r, g, b);
          doc.text(catLabel, data.cell.x + 3, data.cell.y + data.cell.height / 2, {
            baseline: "middle" as const,
          });
        }
      }

      // % of Total column (idx 5) → progress bar
      if (data.column.index === 5) {
        const rawStr = String(data.cell.raw);
        const pct = parseFloat(rawStr);
        if (isNaN(pct)) return;
        const isAlt = data.row.index % 2 === 1;
        doc.setFillColor(...(isAlt ? PDF_C.card : PDF_C.bg));
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
        const barColor: C = isAlt ? [51, 31, 92] : [44, 24, 82];
        const maxBarW = data.cell.width - 6;
        const barW = Math.max(0.5, (pct / 100) * maxBarW);
        doc.setFillColor(...barColor);
        doc.rect(data.cell.x + 3, data.cell.y + 1.8, barW, data.cell.height - 3.6, "F");
        doc.setFont("helvetica", data.row.index === 0 ? "bold" : "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...PDF_C.body);
        doc.text(rawStr, data.cell.x + 3, data.cell.y + data.cell.height / 2, {
          baseline: "middle" as const,
        });
      }
    },
  });

  doc.save(`Klokrs-report-${tab}-${startDate}.pdf`);
}

// ─── Empty state ──────────────────────────────────────────────

function ReportsEmpty() {
  return (
    <EmptyState
      icon="📊"
      title="No sessions tracked for this period"
      description="Keep the extension running and check back later."
    />
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function ReportsPage() {
  const { session: authSession } = useAuthSession();
  const user = authSession?.user ?? null;
  const authToken = authSession?.access_token ?? null;
  const [pageLoading, setPageLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("weekly");
  const [selectedDate, setSelectedDate] = useState(() => resolveTodayAnchor(loadPrefs()));
  const [weekStart, setWeekStart] = useState(() => getMonday(resolveTodayAnchor(loadPrefs())));
  const [monthDate, setMonthDate] = useState(() => resolveTodayAnchor(loadPrefs()));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [hourlyData, setHourlyData] = useState<HourRow[]>([]);
  const [drilldown, setDrilldown] = useState<DrillTarget | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [chartMounted, setChartMounted] = useState(false);

  // ── Category overrides (loaded from prefs, saved back on change) ──
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, CategoryId>>({});

  useEffect(() => { setChartMounted(true); }, []);

  useEffect(() => {
    const p = loadPrefs();
    setCategoryOverrides(p.categoryOverrides);
  }, []);

  const handleCategoryChange = useCallback(
    async (rootDomain: string, cat: CategoryId) => {
      const next = { ...categoryOverrides, [rootDomain]: cat };
      setCategoryOverrides(next);
      const p = loadPrefs();
      savePrefs({ ...p, categoryOverrides: next });
      // Fire-and-forget sync to Supabase
      if (authToken) {
        try {
          await fetch("/api/prefs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ prefs: { ...p, categoryOverrides: next } }),
          });
        } catch { /* silent — localStorage already saved */ }
      }
    },
    [categoryOverrides, authToken]
  );

  const isAtCurrentPeriod = useMemo(() => {
    const today = resolveTodayAnchor(loadPrefs());
    if (tab === "daily") return localDateStr(selectedDate) === localDateStr(today);
    if (tab === "weekly") return localDateStr(weekStart) === localDateStr(getMonday(today));
    return (
      monthDate.getFullYear() === today.getFullYear() &&
      monthDate.getMonth() === today.getMonth()
    );
  }, [tab, selectedDate, weekStart, monthDate]);

  useEffect(() => {
    if (authSession) setPageLoading(false);
  }, [authSession]);

  // ── Date range (memoised) ─────────────────────────────────
  const dateRange = useMemo(() => {
    if (tab === "daily") {
      const d = localDateStr(selectedDate);
      return {
        start: d,
        end: d,
        label: selectedDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        isDaily: true,
      };
    }
    if (tab === "weekly") {
      const end = new Date(weekStart);
      end.setDate(weekStart.getDate() + 6);
      return {
        start: localDateStr(weekStart),
        end: localDateStr(end),
        label: `${fmtShort(weekStart)} – ${fmtShort(end)}, ${weekStart.getFullYear()}`,
        isDaily: false,
      };
    }
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    return {
      start: localDateStr(first),
      end: localDateStr(last),
      label: monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      isDaily: false,
    };
  }, [tab, selectedDate, weekStart, monthDate]);

  // ── Fetch report ──────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!authToken) return;
    setReportLoading(true);
    setReportData(null);
    try {
      const { minSessionSeconds } = loadPrefs();
      const res = await fetch(
        `/api/reports?start_date=${dateRange.start}&end_date=${dateRange.end}&min_seconds=${minSessionSeconds}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.ok) {
        const json = (await res.json()) as ReportData;
        setReportData(json);
      }
    } finally {
      setReportLoading(false);
    }
  }, [authToken, dateRange.start, dateRange.end]);

  useEffect(() => {
    if (authToken) void fetchReport();
  }, [authToken, fetchReport]);

  // ── Fetch hourly (daily tab only) ─────────────────────────
  useEffect(() => {
    if (tab !== "daily" || !user) return;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from("tab_sessions")
        .select("start_time, duration_seconds")
        .eq("user_id", user.id)
        .eq("date", dateRange.start);

      const rows = (data ?? []) as Array<{
        start_time: string;
        duration_seconds: number;
      }>;
      const hours: HourRow[] = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        minutes: 0,
      }));
      for (const s of rows) {
        const h = new Date(s.start_time).getHours();
        if (h >= 0 && h < 24) {
          hours[h]!.minutes += Math.round(s.duration_seconds / 60);
        }
      }
      setHourlyData(hours);
    })();
  }, [tab, user, dateRange.start]);

  // ── Derived stats ─────────────────────────────────────────
  const totalSeconds = useMemo(
    () => (reportData?.by_domain ?? []).reduce((s, d) => s + d.total_seconds, 0),
    [reportData]
  );
  const topDomain = reportData?.by_domain[0]?.domain
    ? getSiteName(reportData.by_domain[0].domain)
    : "—";
  const domainCount = reportData?.by_domain.length ?? 0;

  const mostProductiveDay = useMemo(() => {
    if (!reportData?.by_date.length) return "—";
    const best = reportData.by_date.reduce((a, b) =>
      b.total_seconds > a.total_seconds ? b : a
    );
    return new Date(best.date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [reportData]);

  const dailyAverage = useMemo(() => {
    if (!reportData?.by_date.length) return "—";
    const avg = totalSeconds / reportData.by_date.length;
    return formatTime(Math.round(avg));
  }, [reportData, totalSeconds]);

  const activeTrackedDays = reportData?.by_date.length ?? 0;

  const daysInMonth = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    return new Date(year, month + 1, 0).getDate();
  }, [monthDate]);

  const peakHour = useMemo(() => {
    if (tab !== "daily" || !hourlyData.length) return "—";
    const peak = hourlyData.reduce((a, b) => (b.minutes > a.minutes ? b : a), hourlyData[0]!);
    if (peak.minutes === 0) return "—";
    const h = peak.hour;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:00 ${ampm}`;
  }, [hourlyData, tab]);

  const jumpToCurrent = useCallback(() => {
    const now = resolveTodayAnchor(loadPrefs());
    if (tab === "daily") setSelectedDate(now);
    else if (tab === "weekly") setWeekStart(getMonday(now));
    else setMonthDate(now);
  }, [tab]);

  // ── Weekly chart data ─────────────────────────────────────
  const weeklyChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of reportData?.by_date ?? []) map.set(d.date, d.total_seconds);
    return DAY_NAMES.map((name, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const key = localDateStr(day);
      return {
        day: name,
        hours: parseFloat(((map.get(key) ?? 0) / 3600).toFixed(2)),
      };
    });
  }, [reportData, weekStart]);

  // ── Monthly chart data ────────────────────────────────────
  const monthlyChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of reportData?.by_date ?? []) map.set(d.date, d.total_seconds);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const day = new Date(year, month, i + 1);
      const key = localDateStr(day);
      return {
        date: i + 1,
        hours: parseFloat(((map.get(key) ?? 0) / 3600).toFixed(2)),
      };
    });
  }, [reportData, monthDate]);

  // ── Category stats ────────────────────────────────────────
  const categoryStats = useMemo(
    () => getCategoryStats(reportData?.by_domain ?? [], categoryOverrides),
    [reportData, categoryOverrides]
  );

  // ── PDF export ────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (!reportData?.by_domain.length) return;
    setPdfBusy(true);
    await new Promise<void>((r) => setTimeout(r, 10));
    try {
      const stats =
        tab === "daily"
          ? [
              { title: "Total Time", value: formatTime(totalSeconds) },
              { title: "Top Domain", value: topDomain },
              { title: "Domains", value: String(domainCount) },
              { title: "Peak Hour", value: (() => {
                  const peak = hourlyData.reduce((a, b) => b.minutes > a.minutes ? b : a, hourlyData[0]!);
                  return peak.minutes > 0 ? `${peak.hour}:00` : "—";
                })() },
            ]
          : tab === "weekly"
          ? [
              { title: "Total Hours", value: formatTime(totalSeconds) },
              { title: "Best Day", value: mostProductiveDay },
              { title: "Top Domain", value: topDomain },
              { title: "Domains", value: String(domainCount) },
            ]
          : [
              { title: "Total Hours", value: formatTime(totalSeconds) },
              { title: "Daily Avg", value: dailyAverage },
              { title: "Top Domain", value: topDomain },
              { title: "Domains", value: String(domainCount) },
            ];

      // Build chart data for PDF
      const pdfChartData: PdfChartPoint[] =
        tab === "daily"
          ? hourlyData.map((h) => ({ label: String(h.hour), value: h.minutes }))
          : tab === "weekly"
          ? weeklyChartData.map((d) => ({ label: d.day, value: d.hours }))
          : monthlyChartData.map((d) => ({ label: String(d.date), value: d.hours }));

      const pdfCategoryStats: PdfCategoryStat[] = categoryStats.map((c) => ({
        label: c.label,
        color: c.color,
        seconds: c.seconds,
      }));

      generatePdf(
        tab,
        dateRange.label,
        dateRange.start,
        stats,
        reportData.by_domain,
        pdfChartData,
        tab === "daily" ? "m" : "h",
        pdfCategoryStats,
        user?.email ?? ""
      );
    } finally {
      setPdfBusy(false);
    }
  }, [
    reportData,
    tab,
    totalSeconds,
    topDomain,
    domainCount,
    mostProductiveDay,
    dailyAverage,
    dateRange,
    hourlyData,
    weeklyChartData,
    monthlyChartData,
    categoryStats,
    user,
  ]);

  // ── Loading / auth guard ──────────────────────────────────
  if (pageLoading) {
    return (
      <AppShell title="Reports">
        <Loader />
      </AppShell>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "daily", label: "Daily" },
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
  ];

  const hasData = (reportData?.by_domain.length ?? 0) > 0;

  return (
    <AppShell title="Reports">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
      />

      {/* ── Control bar ───────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab switcher */}
        <div className="relative flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative z-10 rounded-xl px-5 py-2 text-sm font-medium transition-colors duration-200 ${
                tab === t.id ? "text-white" : "text-white/45 hover:text-white/70"
              }`}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="reports-tab-indicator"
                  className="absolute inset-0 rounded-xl border border-violet-500/25 bg-violet-600/20"
                  transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Right side: date nav + export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Jump to current */}
          {!isAtCurrentPeriod && (
            <button
              onClick={jumpToCurrent}
              className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20"
            >
              {tab === "daily" ? "Today" : tab === "weekly" ? "This week" : "This month"}
            </button>
          )}

          {/* Period arrows + label */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (tab === "daily") {
                  const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d);
                } else if (tab === "weekly") {
                  const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
                } else {
                  setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1));
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-white/20 hover:text-white/80"
              aria-label="Previous"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <span className="min-w-[11rem] text-center text-sm font-semibold text-white/80">
              {dateRange.label}
            </span>

            <button
              disabled={isAtCurrentPeriod}
              onClick={() => {
                if (tab === "daily") {
                  const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d);
                } else if (tab === "weekly") {
                  const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
                } else {
                  setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-white/20 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* PDF export — contextual, near the period it exports */}
          {hasData && !reportLoading && (
            <>
              <div className="h-5 w-px bg-white/[0.08]" />
              <button
                onClick={() => void handleExportPdf()}
                disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-violet-500/25 hover:bg-violet-500/[0.08] hover:text-white/90 disabled:opacity-50"
              >
                {pdfBusy ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {reportLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader />
          </motion.div>
        ) : (
          <motion.div
            key={`${tab}-${dateRange.start}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
            className="space-y-4 lg:space-y-5"
          >
            {!hasData ? (
              <ReportsEmpty />
            ) : (
              <>
                {/* ── KPI cards ──────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {tab === "daily" && (
                    <>
                      <StatsCard title="Total Time" value={formatTime(totalSeconds)} subtitle={dateRange.label} accent="violet" delay={0}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>} />
                      <StatsCard title="Top Domain" value={topDomain} subtitle="Most time spent" accent="cyan" delay={0.05}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>} />
                      <StatsCard title="Domains Visited" value={String(domainCount)} subtitle="Unique sites" accent="neutral" delay={0.1}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>} />
                      <StatsCard title="Peak Hour" value={peakHour} subtitle="Most active time" accent="neutral" delay={0.15}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>} />
                    </>
                  )}
                  {tab === "weekly" && (
                    <>
                      <StatsCard title="Total This Week" value={formatTime(totalSeconds)} subtitle={dateRange.label} accent="violet" delay={0}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>} />
                      <StatsCard title="Daily Average" value={dailyAverage} subtitle="Across active days" accent="cyan" delay={0.05}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>} />
                      <StatsCard title="Best Day" value={mostProductiveDay} subtitle="Highest single-day total" accent="neutral" delay={0.1}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>} />
                      <StatsCard title="Top Domain" value={topDomain} subtitle="Most visited site" accent="neutral" delay={0.15}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>} />
                    </>
                  )}
                  {tab === "monthly" && (
                    <>
                      <StatsCard title="Total Hours" value={formatTime(totalSeconds)} subtitle={dateRange.label} accent="violet" delay={0}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>} />
                      <StatsCard title="Daily Average" value={dailyAverage} subtitle="Across tracked days" accent="cyan" delay={0.05}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>} />
                      <StatsCard title="Active Days" value={`${activeTrackedDays}/${daysInMonth}`} subtitle="Days with tracking" accent="neutral" delay={0.1}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="16" height="16" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} />
                      <StatsCard title="Top Domain" value={topDomain} subtitle="Most visited site" accent="neutral" delay={0.15}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>} />
                    </>
                  )}
                </div>

                {/* ── Chart ─────────────────────────────── */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/25">Trend</p>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
                >
                  <div className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
                    <h3 className="text-base font-semibold text-white/95">
                      {tab === "daily" ? "Time by hour" : tab === "weekly" ? "Daily breakdown" : "Daily trend"}
                    </h3>
                    <p className="mt-0.5 text-sm text-white/40">
                      {tab === "daily"
                        ? `Minutes tracked per hour · ${formatTime(totalSeconds)} total today`
                        : `Hours tracked per day · ${formatTime(totalSeconds)} total`}
                    </p>
                  </div>
                  <div className="px-2 pb-4 pt-3 sm:px-3 sm:pb-5 sm:pt-4">
                    <div className="h-64 w-full">
                      {chartMounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          {tab === "monthly" ? (
                            <LineChart data={monthlyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v % 5 === 1 ? String(v) : ""} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} width={38} tickFormatter={(v: number) => `${v}h`} />
                              <Tooltip content={<ChartTooltip unit="h" />} cursor={{ stroke: "rgba(124,58,237,0.2)" }} />
                              <Line type="monotone" dataKey="hours" stroke="#7C3AED" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#7C3AED" }} isAnimationActive animationDuration={700} />
                            </LineChart>
                          ) : tab === "weekly" ? (
                            <BarChart data={weeklyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="24%">
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} width={38} tickFormatter={(v: number) => `${v}h`} />
                              <Tooltip content={<ChartTooltip unit="h" />} cursor={{ fill: "rgba(124,58,237,0.08)", radius: 6 }} />
                              <defs>
                                <linearGradient id="weekly-bar-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.75} />
                                </linearGradient>
                              </defs>
                              <Bar dataKey="hours" fill="url(#weekly-bar-grad)" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive animationDuration={700} />
                            </BarChart>
                          ) : (
                            <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="10%">
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(h: number) => h % 6 === 0 ? `${h}h` : ""} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} width={38} tickFormatter={(v: number) => `${v}m`} />
                              <Tooltip content={<ChartTooltip unit="m" />} cursor={{ fill: "rgba(124,58,237,0.08)" }} />
                              <defs>
                                <linearGradient id="daily-hour-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.7} />
                                </linearGradient>
                              </defs>
                              <Bar dataKey="minutes" fill="url(#daily-hour-grad)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive animationDuration={700} />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </motion.div>
                </div>

                {/* ── Category breakdown ────────────────── */}
                {categoryStats.length >= 1 && (
                  <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/25">Categories</p>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.18 }}
                    className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
                  >
                    <div className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
                      <h3 className="text-base font-semibold text-white/95">By category</h3>
                      <p className="mt-0.5 text-sm text-white/40">
                        How your time broke down across activity types · click a tag to recategorize
                      </p>
                    </div>
                    <div className="space-y-2.5 px-4 py-4 sm:px-5">
                      {categoryStats.map((cat) => {
                        const pct = Math.round((cat.seconds / totalSeconds) * 100);
                        return (
                          <div key={cat.id} className="flex items-center gap-3">
                            <div className="flex w-32 shrink-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate text-xs font-medium text-white/65">
                                {cat.label}
                              </span>
                            </div>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.65, ease: "easeOut" }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: cat.color + "CC" }}
                              />
                            </div>
                            <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums text-white/80">
                              {formatTime(cat.seconds)}
                            </span>
                            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-white/35">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                  </div>
                )}

                {/* ── Domain table ──────────────────────── */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/25">Domains</p>
                  <ReportsDomainTable
                    data={reportData?.by_domain ?? []}
                    onDomainClick={(domain, totalSeconds) =>
                      setDrilldown({ domain, totalSeconds })
                    }
                    categoryOverrides={categoryOverrides}
                    onCategoryChange={(root, cat) => { void handleCategoryChange(root, cat); }}
                  />
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drilldown modal ───────────────────────────────────── */}
      {drilldown && (
        <DomainDrilldownModal
          domain={drilldown.domain}
          startDate={dateRange.start}
          endDate={dateRange.end}
          isDaily={dateRange.isDaily}
          totalSeconds={drilldown.totalSeconds}
          onClose={() => setDrilldown(null)}
        />
      )}
    </AppShell>
  );
}
