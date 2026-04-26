"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExtensionAuthSync } from "@/components/ExtensionAuthSync";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  children: ReactNode;
  title: string;
  /** Inner content max width (Tailwind class) */
  contentMaxClassName?: string;
};

export function AppShell({
  children,
  title,
  contentMaxClassName = "max-w-7xl",
}: AppShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="relative flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#0A0A0F] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-violet-600/6 blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <ExtensionAuthSync />

        <header className="supports-[padding:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)] z-30 flex h-14 min-h-[3.5rem] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0A0A0F]/90 px-3 backdrop-blur-xl lg:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 transition hover:border-white/20 hover:bg-white/10"
              aria-expanded={open}
              aria-label="Open menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="min-w-0 truncate text-base font-semibold tracking-tight text-white/95">
              {title}
            </span>
          </div>
          <Link
            href="/"
            className="shrink-0 text-xs font-medium text-violet-400/90 hover:text-violet-300"
          >
            Tably
          </Link>
        </header>

        <div className="flex w-full min-h-0 min-w-0 flex-1 items-stretch overflow-hidden">
          {open && (
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-black/60 lg:hidden"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
          )}

          <Sidebar mobileOpen={open} onMobileClose={() => setOpen(false)} />

          <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-0 sm:pt-0 touch-pan-y">
            <div
              className={`mx-auto w-full px-4 pb-4 pt-2 sm:px-5 sm:pb-6 sm:pt-3 lg:px-6 lg:pb-8 lg:pt-4 ${contentMaxClassName}`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
