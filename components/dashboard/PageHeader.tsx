"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  /** Small uppercase label above the title — e.g. "Overview · Today" */
  eyebrow: string;
  /** Main heading text */
  title: string;
  /** Optional gradient-coloured suffix appended to the title on the same line */
  titleHighlight?: string;
  /** Secondary line below the title — date string, short context, etc. */
  subtitle?: string;
  /** Right-side slot: action buttons, badges, indicators */
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  titleHighlight,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mb-9 sm:mb-12"
    >
      {/* Top rule */}
      <div className="mb-5 h-px w-full bg-gradient-to-r from-violet-500/20 via-white/[0.06] to-transparent" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {/* Eyebrow */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400/80">
            {eyebrow}
          </p>

          {/* Title */}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-[2rem]">
            {titleHighlight ? (
              <>
                <span className="text-white/95">{title}</span>
                <span className="bg-gradient-to-r from-violet-300 via-violet-200 to-cyan-300 bg-clip-text text-transparent">
                  {" "}{titleHighlight}
                </span>
              </>
            ) : (
              <span className="text-white/95">{title}</span>
            )}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p className="mt-1.5 text-sm text-white/35 tracking-wide">{subtitle}</p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}
