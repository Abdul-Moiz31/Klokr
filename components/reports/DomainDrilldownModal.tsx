"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSiteName, getFamilyDomains } from "@/lib/domain";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase";
import { Loader } from "@/components/ui/Loader";

interface PageRow {
  domain: string;
  duration_seconds: number;
  visits: number;
  last_visited: string;
}

interface HourRow {
  hour: number;
  minutes: number;
}

interface Props {
  domain: string;
  startDate: string;
  endDate: string;
  isDaily: boolean;
  totalSeconds: number;
  onClose: () => void;
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}


const HourTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f0f16]/95 px-3 py-2 text-xs shadow-xl">
      <p className="text-white/40">{label}:00</p>
      <p className="font-bold text-white">{payload[0]?.value ?? 0}m</p>
    </div>
  );
};

export function DomainDrilldownModal({
  domain,
  startDate,
  endDate,
  isDaily,
  totalSeconds,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [hourly, setHourly] = useState<HourRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Match every domain in this brand's family (e.g. "github.com" also
      // pulls in "githubusercontent.com", "github.io", …) exactly or by a
      // genuine subdomain — never an unanchored substring. The previous
      // `.ilike("domain", "%"+domain)` matched anything merely *ending with*
      // the string, so a "github.com" drilldown also silently pulled in an
      // unrelated domain like "evilgithub.com".
      const familyRoots = getFamilyDomains(domain);
      const orFilter = familyRoots
        .map((root) => `domain.eq.${root},domain.like.%.${root}`)
        .join(",");

      const { data } = await supabase
        .from("tab_sessions")
        .select("domain, duration_seconds, visits, end_time, start_time")
        .eq("user_id", user.id)
        .or(orFilter)
        .gte("date", startDate)
        .lte("date", endDate);

      const sessions = (data ?? []) as Array<{
        domain: string;
        duration_seconds: number;
        visits: number;
        end_time: string;
        start_time: string;
      }>;

      // Aggregate by subdomain
      const pageMap = new Map<
        string,
        { duration: number; visits: number; lastVisited: string }
      >();
      for (const s of sessions) {
        const key = s.domain;
        const cur = pageMap.get(key) ?? { duration: 0, visits: 0, lastVisited: "" };
        pageMap.set(key, {
          duration: cur.duration + s.duration_seconds,
          visits: cur.visits + (s.visits ?? 1),
          lastVisited: s.end_time > cur.lastVisited ? s.end_time : cur.lastVisited,
        });
      }
      setPages(
        Array.from(pageMap.entries())
          .map(([subdomain, { duration, visits, lastVisited }]) => ({
            domain: subdomain,
            duration_seconds: duration,
            visits,
            last_visited: lastVisited,
          }))
          .sort((a, b) => b.duration_seconds - a.duration_seconds)
      );

      // Hourly breakdown (daily only)
      if (isDaily) {
        const hours: HourRow[] = Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          minutes: 0,
        }));
        for (const s of sessions) {
          const h = new Date(s.start_time).getHours();
          if (h >= 0 && h < 24) {
            hours[h]!.minutes += Math.floor(s.duration_seconds / 60);
          }
        }
        setHourly(hours);
      }

      setLoading(false);
    })();
  }, [domain, startDate, endDate, isDaily]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const displayName = getSiteName(domain);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.65)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 8 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0f0f16] shadow-2xl shadow-black/70"
        >
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#0f0f16]/98 px-6 py-4 backdrop-blur-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                alt=""
                width={20}
                height={20}
                className="rounded-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = "0.25";
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-white/95">
                {displayName}
              </h2>
              <p className="text-xs text-white/40">
                {formatTime(totalSeconds)} total
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white/80"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6 p-6">
            {loading ? (
              <Loader clockSize={60} className="py-8" />
            ) : pages.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-white/30">
                  No page-level data for this period
                </p>
              </div>
            ) : (
              <>
                {/* Hourly chart — daily view only */}
                {isDaily && (
                  <div>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                      Hourly activity
                    </p>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={hourly}
                          margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
                          barCategoryGap="12%"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="rgba(255,255,255,0.05)"
                          />
                          <XAxis
                            dataKey="hour"
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(h: number) =>
                              h % 6 === 0 ? `${h}h` : ""
                            }
                          />
                          <YAxis
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => `${v}m`}
                          />
                          <Tooltip
                            content={<HourTooltip />}
                            cursor={{ fill: "rgba(124,58,237,0.08)" }}
                          />
                          <Bar
                            dataKey="minutes"
                            fill="#7C3AED"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={20}
                            isAnimationActive
                            animationDuration={600}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Page breakdown table */}
                <div>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    Page breakdown
                  </p>
                  <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/25">
                            Domain
                          </th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25">
                            Time
                          </th>
                          <th className="hidden px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25 sm:table-cell">
                            Visits
                          </th>
                          <th className="hidden px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25 sm:table-cell">
                            Last seen
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {pages.map((p) => (
                          <tr
                            key={p.domain}
                            className="hover:bg-white/[0.03]"
                          >
                            <td className="max-w-[14rem] px-4 py-3">
                              <span
                                className="block truncate text-white/80"
                                title={p.domain}
                              >
                                {p.domain}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums text-white/90">
                              {formatTime(p.duration_seconds)}
                            </td>
                            <td className="hidden px-4 py-3 text-right tabular-nums text-white/40 sm:table-cell">
                              {p.visits}
                            </td>
                            <td className="hidden px-4 py-3 text-right tabular-nums text-white/35 sm:table-cell">
                              {p.last_visited
                                ? new Date(p.last_visited).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
