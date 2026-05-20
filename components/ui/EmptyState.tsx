"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "default" | "compact";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: Variant;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className = "",
}: EmptyStateProps) {
  const isCompact = variant === "compact";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] text-center ${
        isCompact ? "gap-3 px-6 py-10" : "gap-4 px-8 py-14 sm:py-16"
      } ${className}`}
    >
      {icon && (
        <div
          className={`flex items-center justify-center rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/15 to-cyan-500/10 ${
            isCompact ? "h-11 w-11 text-xl" : "h-14 w-14 text-2xl"
          }`}
        >
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <p
          className={`font-semibold text-white/85 ${
            isCompact ? "text-sm" : "text-base sm:text-lg"
          }`}
        >
          {title}
        </p>
        {description && (
          <p
            className={`mt-1 leading-relaxed text-white/45 ${
              isCompact ? "text-xs" : "text-sm"
            }`}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}
