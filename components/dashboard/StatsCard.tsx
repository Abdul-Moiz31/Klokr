"use client";

import { motion } from "framer-motion";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  badge?: { label: string; color: "green" | "yellow" | "red" };
  subtitle?: string;
  tooltip?: string;
  delay?: number;
  accent?: "violet" | "cyan" | "neutral";
}

const styles = {
  violet: {
    icon: "from-violet-500/20 to-violet-600/5 text-violet-300 border-violet-500/25",
    glow: "bg-violet-500/10",
    bar: "from-violet-500 to-violet-400",
    value: "from-violet-200 to-white",
  },
  cyan: {
    icon: "from-cyan-500/20 to-cyan-600/5 text-cyan-300 border-cyan-500/25",
    glow: "bg-cyan-500/10",
    bar: "from-cyan-500 to-cyan-400",
    value: "from-cyan-200 to-white",
  },
  neutral: {
    icon: "from-white/10 to-white/5 text-white/60 border-white/10",
    glow: "bg-white/8",
    bar: "from-white/30 to-white/20",
    value: "from-white to-white/80",
  },
} as const;

export function StatsCard({
  title,
  value,
  icon,
  badge,
  subtitle,
  tooltip,
  delay = 0,
  accent = "violet",
}: StatsCardProps) {
  const s = styles[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-lg shadow-black/25 backdrop-blur-md transition-all duration-300 hover:border-white/[0.16] hover:bg-white/[0.06]"
    >
      {/* Hover glow blob */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full ${s.glow} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
        aria-hidden
      />

      {/* Top row: icon + badge */}
      <div className="relative mb-5 flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${s.icon}`}>
          {icon}
        </div>
        {badge && (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
              badge.color === "green"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : badge.color === "yellow"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                  : "border-red-500/25 bg-red-500/10 text-red-400"
            }`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Label */}
      <div className="relative mb-1 flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">{title}</p>
        {tooltip && <InfoTooltip text={tooltip} side="bottom" />}
      </div>

      {/* Value */}
      <p
        className={`relative break-all text-[1.75rem] font-bold leading-none tracking-tight bg-gradient-to-br bg-clip-text text-transparent ${s.value}`}
      >
        {value}
      </p>

      {subtitle && (
        <p className="relative mt-1.5 text-xs text-white/35">{subtitle}</p>
      )}

      {/* Bottom accent stripe */}
      <div
        className={`pointer-events-none absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r ${s.bar} opacity-0 transition-opacity duration-300 group-hover:opacity-60`}
        aria-hidden
      />
    </motion.div>
  );
}
