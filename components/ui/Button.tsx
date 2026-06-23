"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2.5 font-semibold rounded-full transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white hover:shadow-[0_0_25px_rgba(124,58,237,0.6)]",
  secondary:
    "border border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
  accent:
    "border border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300",
  ghost: "text-white/70 hover:text-white hover:bg-white/5",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-5 py-2 text-sm",
  md: "px-7 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

/** Shared class builder so non-<button> CTAs (e.g. next/link) can match Button's look. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = ""
) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

/** The arrow-in-circle icon used by primary CTAs across the landing page. */
export function ButtonArrowIcon({ size = 28 }: { size?: number }) {
  const iconSize = Math.round(size * 0.46);
  return (
    <span
      className="flex items-center justify-center rounded-full bg-white/20"
      style={{ width: size, height: size }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
      </svg>
    </span>
  );
}

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  form?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  type = "button",
  disabled,
  form,
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={buttonClasses(variant, size, className)}
      onClick={onClick}
      type={type}
      disabled={disabled}
      form={form}
    >
      {children}
    </motion.button>
  );
}
