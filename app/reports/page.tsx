"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { ReportsDomainTable } from "@/components/reports/ReportsDomainTable";
import { DomainDrilldownModal } from "@/components/reports/DomainDrilldownModal";
import { getSiteName } from "@/lib/domain";
import type { User } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
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

// ─── Chart tooltip ────────────────────────────────────────────────

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

// ─── PDF generator ────────────────────────────────────────────────

function generatePdf(
  tab: Tab,
  label: string,
  startDate: string,
  stats: { title: string; value: string }[],
  domains: ByDomain[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const M = 10; // margin

  // ── Palette (RGB) ────────────────────────────────────────────
  const C = {
    bg:     [10,  10,  15]  as [number, number, number], // #0A0A0F
    violet: [124, 58,  237] as [number, number, number], // #7C3AED
    cyan:   [6,   182, 212] as [number, number, number], // #06B6D4
    card:   [17,  17,  24]  as [number, number, number], // #111118
    border: [31,  31,  46]  as [number, number, number], // #1F1F2E
    body:   [226, 232, 240] as [number, number, number], // #E2E8F0
    muted:  [100, 116, 139] as [number, number, number], // #64748B
    white:  [255, 255, 255] as [number, number, number], // #FFFFFF
  };

  // ── Fill page background ─────────────────────────────────────
  const fillBg = () => {
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pageW, pageH, "F");
  };
  fillBg();

  // Patch addPage so every new page gets the dark background
  // before autoTable draws cells on it.
  const _addPage = doc.addPage.bind(doc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).addPage = (...args: unknown[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (_addPage as any)(...args);
    fillBg();
    return r;
  };

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── 1. Header bar ────────────────────────────────────────────
  const hdrH = 20;
  doc.setFillColor(...C.violet);
  doc.rect(0, 0, pageW, hdrH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...C.white);
  doc.text("Klokrs", M, 13.5);

  const tabCap = tab.charAt(0).toUpperCase() + tab.slice(1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${tabCap} Report  |  ${label}`, pageW - M, 13.5, { align: "right" });

  // ── 2. Divider — #7C3AED @ 40% blended onto #0A0A0F ────────
  doc.setDrawColor(56, 29, 104);
  doc.setLineWidth(0.4);
  doc.line(M, hdrH + 1, pageW - M, hdrH + 1);

  // ── 3. Summary section ───────────────────────────────────────
  let y = hdrH + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.cyan);
  doc.text("OVERVIEW", M, y);
  y += 5;

  const n = Math.min(stats.length, 3);
  const gap = 3;
  const boxW = (pageW - M * 2 - gap * (n - 1)) / n;
  const boxH = 26;

  for (let i = 0; i < n; i++) {
    const bx = M + i * (boxW + gap);
    const by = y;

    doc.setFillColor(...C.card);
    doc.roundedRect(bx, by, boxW, boxH, 1.5, 1.5, "F");
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, boxW, boxH, 1.5, 1.5, "D");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(stats[i]!.title.toUpperCase(), bx + 5, by + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...C.body);
    doc.text(stats[i]!.value, bx + 5, by + 18.5);

    // Violet accent underline beneath value
    doc.setFillColor(...C.violet);
    doc.rect(bx + 5, by + 21, 9, 0.7, "F");
  }
  y += boxH + 8;

  // ── 4. Section title ─────────────────────────────────────────
  // Small violet accent bar to the left of the label
  doc.setFillColor(...C.violet);
  doc.rect(M, y - 3.5, 1.2, 4.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.cyan);
  doc.text("TIME BY DOMAIN", M + 3.5, y);
  y += 4;

  // ── 5. Domain table ──────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    head: [["#", "Domain", "Total Time", "Visits", "% of Total"]],
    body: domains.map((d, i) => [
      String(i + 1),
      getSiteName(d.domain),
      formatTime(d.total_seconds),
      String(d.visit_count),
      `${d.percentage_of_total}%`,
    ]),
    columnStyles: {
      0: { cellWidth: 11, halign: "center" as const },
      1: { cellWidth: "auto" as const },
      2: { cellWidth: 28, halign: "right" as const },
      3: { cellWidth: 20, halign: "right" as const },
      4: { cellWidth: 38 },
    },
    headStyles: {
      fillColor: C.violet,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor: C.bg,
      textColor: C.body,
      fontSize: 9,
      lineColor: C.border,
      lineWidth: 0.2,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: C.card },
    showHead: "everyPage",

    // Footer on every page
    didDrawPage: () => {
      doc.setFillColor(...C.card);
      doc.rect(0, pageH - 12, pageW, 12, "F");
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(0, pageH - 12, pageW, pageH - 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text("Generated by Klokrs", M, pageH - 5);
      doc.text(today, pageW - M, pageH - 5, { align: "right" });
    },

    didDrawCell: (data) => {
      if (data.section !== "body") return;

      // Row 0, Total Time column (idx 2) → repaint cyan bold
      if (data.row.index === 0 && data.column.index === 2) {
        doc.setFillColor(...C.bg); // row 0 = non-alternate = bg
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...C.cyan);
        doc.text(
          String(data.cell.raw),
          data.cell.x + data.cell.width - 3,
          data.cell.y + data.cell.height / 2,
          { align: "right", baseline: "middle" as const }
        );
      }

      // % of Total column (idx 4) → progress bar + repaint text
      if (data.column.index === 4) {
        const rawStr = String(data.cell.raw);
        const pct = parseFloat(rawStr);
        if (isNaN(pct)) return;

        const isAlt = data.row.index % 2 === 1;

        // 1. Repaint cell background
        doc.setFillColor(...(isAlt ? C.card : C.bg));
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");

        // 2. Progress bar — pre-blended 30% #7C3AED on each bg
        //    On #0A0A0F: rgb(44, 24, 82)   On #111118: rgb(51, 31, 92)
        const barColor: [number, number, number] = isAlt ? [51, 31, 92] : [44, 24, 82];
        const maxBarW = data.cell.width - 6;
        const barW = Math.max(0.5, (pct / 100) * maxBarW);
        doc.setFillColor(...barColor);
        doc.rect(data.cell.x + 3, data.cell.y + 1.8, barW, data.cell.height - 3.6, "F");

        // 3. Text on top of bar
        doc.setFont("helvetica", data.row.index === 0 ? "bold" : "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.body);
        doc.text(rawStr, data.cell.x + 3, data.cell.y + data.cell.height / 2, {
          baseline: "middle" as const,
        });
      }
    },
  });

  // ── Save ─────────────────────────────────────────────────────
  doc.save(`Klokrs-report-${tab}-${startDate}.pdf`);
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-20 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/15 to-cyan-500/10 text-2xl">
        📊
      </div>
      <div>
        <p className="text-base font-semibold text-white/60">
          No sessions tracked for this period
        </p>
        <p className="mt-1 text-sm text-white/30">
          Keep the extension running and check back later
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function ReportsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("weekly");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [monthDate, setMonthDate] = useState(new Date());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [hourlyData, setHourlyData] = useState<HourRow[]>([]);
  const [drilldown, setDrilldown] = useState<DrillTarget | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [chartMounted, setChartMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setChartMounted(true); }, []);

  // ── Auth ────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
      setAuthToken(session.access_token ?? null);
      setPageLoading(false);
    })();
  }, [router]);

  // ── Date range (memoised) ───────────────────────────────────────
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
    // monthly
    const first = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1
    );
    const last = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0
    );
    return {
      start: localDateStr(first),
      end: localDateStr(last),
      label: monthDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      isDaily: false,
    };
  }, [tab, selectedDate, weekStart, monthDate]);

  // ── Fetch report ────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!authToken) return;
    setReportLoading(true);
    setReportData(null);
    try {
      const res = await fetch(
        `/api/reports?start_date=${dateRange.start}&end_date=${dateRange.end}`,
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

  // ── Fetch hourly (daily tab only) ───────────────────────────────
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

  // ── Derived stats ───────────────────────────────────────────────
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
      weekday: "long",
    });
  }, [reportData]);

  const dailyAverage = useMemo(() => {
    if (!reportData?.by_date.length) return "—";
    const avg = totalSeconds / reportData.by_date.length;
    return formatTime(Math.round(avg));
  }, [reportData, totalSeconds]);

  // ── Weekly chart data ───────────────────────────────────────────
  const weeklyChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of reportData?.by_date ?? []) {
      map.set(d.date, d.total_seconds);
    }
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

  // ── Monthly chart data ──────────────────────────────────────────
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

  // ── PDF export ──────────────────────────────────────────────────
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
            ]
          : tab === "weekly"
          ? [
              { title: "Total Hours", value: formatTime(totalSeconds) },
              { title: "Best Day", value: mostProductiveDay },
              { title: "Top Domain", value: topDomain },
            ]
          : [
              { title: "Total Hours", value: formatTime(totalSeconds) },
              { title: "Daily Avg", value: dailyAverage },
              { title: "Top Domain", value: topDomain },
            ];
      generatePdf(
        tab,
        dateRange.label,
        dateRange.start,
        stats,
        reportData.by_domain
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
  ]);

  // ── Loading / auth guard ────────────────────────────────────────
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
        actions={
          hasData && !reportLoading ? (
            <button
              onClick={() => void handleExportPdf()}
              disabled={pdfBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white disabled:opacity-50"
            >
              {pdfBusy ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
              Export PDF
            </button>
          ) : undefined
        }
      />

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative z-10 rounded-xl px-5 py-2 text-sm font-medium transition-colors duration-200 ${
                tab === t.id
                  ? "text-white"
                  : "text-white/45 hover:text-white/70"
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

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          {/* Prev */}
          <button
            onClick={() => {
              if (tab === "daily") {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d);
              } else if (tab === "weekly") {
                const d = new Date(weekStart);
                d.setDate(d.getDate() - 7);
                setWeekStart(d);
              } else {
                const d = new Date(
                  monthDate.getFullYear(),
                  monthDate.getMonth() - 1,
                  1
                );
                setMonthDate(d);
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-white/20 hover:text-white/80"
            aria-label="Previous"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <span className="min-w-[11rem] text-center text-sm font-medium text-white/70">
            {dateRange.label}
          </span>

          {/* Next */}
          <button
            onClick={() => {
              if (tab === "daily") {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d);
              } else if (tab === "weekly") {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + 7);
                setWeekStart(d);
              } else {
                const d = new Date(
                  monthDate.getFullYear(),
                  monthDate.getMonth() + 1,
                  1
                );
                setMonthDate(d);
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-white/20 hover:text-white/80"
            aria-label="Next"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {reportLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader />
          </motion.div>
        ) : (
          <motion.div
            key={`${tab}-${dateRange.start}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
            className="space-y-6 lg:space-y-8"
          >
            {!hasData ? (
              <EmptyState />
            ) : (
              <>
                {/* ── KPI cards ─────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  {tab === "daily" && (
                    <>
                      <StatsCard
                        title="Total Time"
                        value={formatTime(totalSeconds)}
                        subtitle={dateRange.label}
                        accent="violet"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                          </svg>
                        }
                      />
                      <StatsCard
                        title="Top Domain"
                        value={topDomain}
                        subtitle="Most time spent"
                        accent="cyan"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        }
                      />
                      <StatsCard
                        title="Domains Visited"
                        value={String(domainCount)}
                        subtitle="Unique sites"
                        accent="neutral"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                          </svg>
                        }
                      />
                    </>
                  )}
                  {tab === "weekly" && (
                    <>
                      <StatsCard
                        title="Total This Week"
                        value={formatTime(totalSeconds)}
                        subtitle={dateRange.label}
                        accent="violet"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                          </svg>
                        }
                      />
                      <StatsCard
                        title="Most Productive Day"
                        value={mostProductiveDay}
                        subtitle="Highest single-day total"
                        accent="cyan"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                          </svg>
                        }
                      />
                      <StatsCard
                        title="Top Domain"
                        value={topDomain}
                        subtitle="Most visited site"
                        accent="neutral"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        }
                      />
                    </>
                  )}
                  {tab === "monthly" && (
                    <>
                      <StatsCard
                        title="Total Hours"
                        value={formatTime(totalSeconds)}
                        subtitle={dateRange.label}
                        accent="violet"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                          </svg>
                        }
                      />
                      <StatsCard
                        title="Daily Average"
                        value={dailyAverage}
                        subtitle="Across tracked days"
                        accent="cyan"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
                          </svg>
                        }
                      />
                      <StatsCard
                        title="Top Domain"
                        value={topDomain}
                        subtitle="Most visited site"
                        accent="neutral"
                        icon={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        }
                      />
                    </>
                  )}
                </div>

                {/* ── Chart ─────────────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/25 backdrop-blur-md"
                >
                  <div className="border-b border-white/[0.07] px-6 py-5 sm:px-8">
                    <h3 className="text-base font-semibold text-white/95">
                      {tab === "daily"
                        ? "Time by hour"
                        : tab === "weekly"
                        ? "Daily breakdown"
                        : "Daily trend"}
                    </h3>
                    <p className="mt-0.5 text-sm text-white/40">
                      {tab === "daily"
                        ? "Minutes tracked per hour of day"
                        : "Hours tracked per day"}
                    </p>
                  </div>
                  <div className="px-2 pb-6 pt-4 sm:px-4 sm:pb-8 sm:pt-6">
                    <div className="h-64 w-full">
                      {chartMounted && <ResponsiveContainer width="100%" height="100%">
                        {tab === "monthly" ? (
                          <LineChart
                            data={monthlyChartData}
                            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="rgba(255,255,255,0.05)"
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v: number) =>
                                v % 5 === 1 ? String(v) : ""
                              }
                            />
                            <YAxis
                              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              width={38}
                              tickFormatter={(v: number) => `${v}h`}
                            />
                            <Tooltip
                              content={<ChartTooltip unit="h" />}
                              cursor={{ stroke: "rgba(124,58,237,0.2)" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="hours"
                              stroke="#7C3AED"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4, fill: "#7C3AED" }}
                              isAnimationActive
                              animationDuration={700}
                            />
                          </LineChart>
                        ) : tab === "weekly" ? (
                          <BarChart
                            data={weeklyChartData}
                            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                            barCategoryGap="24%"
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="rgba(255,255,255,0.05)"
                            />
                            <XAxis
                              dataKey="day"
                              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              width={38}
                              tickFormatter={(v: number) => `${v}h`}
                            />
                            <Tooltip
                              content={<ChartTooltip unit="h" />}
                              cursor={{ fill: "rgba(124,58,237,0.08)", radius: 6 }}
                            />
                            <defs>
                              <linearGradient
                                id="weekly-bar-grad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#7C3AED"
                                  stopOpacity={0.9}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#06B6D4"
                                  stopOpacity={0.75}
                                />
                              </linearGradient>
                            </defs>
                            <Bar
                              dataKey="hours"
                              fill="url(#weekly-bar-grad)"
                              radius={[6, 6, 0, 0]}
                              maxBarSize={44}
                              isAnimationActive
                              animationDuration={700}
                            />
                          </BarChart>
                        ) : (
                          /* Daily — hours by hour */
                          <BarChart
                            data={hourlyData}
                            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                            barCategoryGap="10%"
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="rgba(255,255,255,0.05)"
                            />
                            <XAxis
                              dataKey="hour"
                              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(h: number) =>
                                h % 6 === 0 ? `${h}h` : ""
                              }
                            />
                            <YAxis
                              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              width={38}
                              tickFormatter={(v: number) => `${v}m`}
                            />
                            <Tooltip
                              content={<ChartTooltip unit="m" />}
                              cursor={{ fill: "rgba(124,58,237,0.08)" }}
                            />
                            <defs>
                              <linearGradient
                                id="daily-hour-grad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#7C3AED"
                                  stopOpacity={0.9}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#06B6D4"
                                  stopOpacity={0.7}
                                />
                              </linearGradient>
                            </defs>
                            <Bar
                              dataKey="minutes"
                              fill="url(#daily-hour-grad)"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={28}
                              isAnimationActive
                              animationDuration={700}
                            />
                          </BarChart>
                        )}
                      </ResponsiveContainer>}
                    </div>
                  </div>
                </motion.div>

                {/* ── Domain table ───────────────────────────────── */}
                <ReportsDomainTable
                  data={reportData?.by_domain ?? []}
                  onDomainClick={(domain, totalSeconds) =>
                    setDrilldown({ domain, totalSeconds })
                  }
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drilldown modal ───────────────────────────────────────── */}
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
