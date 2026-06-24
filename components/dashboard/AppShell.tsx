"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExtensionAuthSync } from "@/components/ExtensionAuthSync";
import { Sidebar } from "./Sidebar";
import { RestrictedNotice } from "./RestrictedNotice";
import { NotificationBell } from "./NotificationBell";
import { HeaderSearch } from "./HeaderSearch";
import { Tour } from "./Tour";
import { createClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

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
  // Lightweight user-id fetch for the notification bell (no redirect logic —
  // the page itself handles auth gating).
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) setUserId(session?.user?.id ?? null);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e: string, s: Session | null) => {
      if (!cancelled) setUserId(s?.user?.id ?? null);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

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
        <RestrictedNotice />

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
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell userId={userId} />
            <Link
              href="/"
              className="text-xs font-medium text-violet-400/90 hover:text-violet-300"
            >
              Klokrs
            </Link>
          </div>
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

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Desktop header bar */}
            <header className="hidden h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A0A0F]/85 px-5 backdrop-blur-xl lg:flex">
              <HeaderSearch />
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("klokrs:start-tour"))}
                  title="Replay product tour"
                  aria-label="Replay product tour"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/80"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4" /><line x1="12" y1="17" x2="12" y2="17.01" />
                  </svg>
                </button>
                <Link
                  href="/dashboard/settings"
                  title="Settings"
                  aria-label="Settings"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/80"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </Link>
                <NotificationBell userId={userId} />
              </div>
            </header>

            <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-0 sm:pt-0 touch-pan-y">
              <div
                className={`mx-auto w-full px-4 pb-6 pt-4 sm:px-6 sm:pb-7 sm:pt-5 lg:px-7 lg:pb-8 lg:pt-6 ${contentMaxClassName}`}
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
      <Tour />
    </div>
  );
}
