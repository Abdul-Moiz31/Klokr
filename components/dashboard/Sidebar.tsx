"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

function initialsFromUser(user: User | null): string {
  if (!user) return "?";
  const name =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name) ||
    user.email?.split("@")[0] ||
    "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    if (a && b) return (a + b).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

type Props = {
  /** Mobile drawer open state (desktop ignores) */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ mobileOpen = false, onMobileClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const menuId = useId();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const gradId = `sbgrad-${useId().replace(/:/g, "")}`;

  const closeIfMobile = useCallback(() => {
    onMobileClose?.();
  }, [onMobileClose]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e: string, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = useCallback(async () => {
    setMenuOpen(false);
    closeIfMobile();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }, [router, closeIfMobile]);

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      href: "/activity",
      label: "Activity",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="4" height="16" rx="1" />
          <rect x="10" y="8" width="4" height="12" rx="1" />
          <rect x="17" y="2" width="4" height="20" rx="1" />
        </svg>
      ),
    },
    {
      href: "/reports",
      label: "Reports",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
      ),
    },
    {
      href: "/pomodoro",
      label: "Pomodoro",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      href: "/daily-planner",
      label: "Daily planner",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 2v4" />
          <path d="M16 2v4" />
        </svg>
      ),
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  const linkClass = (active: boolean) =>
    `flex min-h-[2.75rem] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      active
        ? "border border-violet-500/20 bg-violet-600/20 text-violet-300"
        : "border border-transparent text-white/50 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <aside
      id="app-sidebar"
      className={`flex w-64 shrink-0 flex-col border-r border-white/10 bg-white/3 backdrop-blur-xl transition-transform duration-200 ease-out min-h-0 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:h-[100dvh] max-lg:min-h-0 max-lg:w-[min(18rem,100vw-3rem)] max-lg:max-w-sm max-lg:bg-[#0c0c12]/95 lg:static lg:z-auto lg:h-full lg:max-w-none lg:translate-x-0 ${
        mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
      }`}
    >
      <div className="border-b border-white/10 p-4 sm:p-5 lg:p-6">
        <Link
          href="/"
          onClick={closeIfMobile}
          className="flex items-center gap-2"
        >
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
            <circle cx="14" cy="14" r="13" stroke={`url(#${gradId})`} strokeWidth="2" />
            <circle cx="14" cy="14" r="3" fill={`url(#${gradId})`} />
            <line
              x1="14"
              y1="14"
              x2="14"
              y2="6"
              stroke={`url(#${gradId})`}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="14"
              y1="14"
              x2="19"
              y2="17"
              stroke={`url(#${gradId})`}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient
                id={gradId}
                x1="0"
                y1="0"
                x2="28"
                y2="28"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-bold text-white">Klokrs</span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 sm:p-4">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href === "/activity"
                ? pathname === "/activity"
                : item.href === "/reports"
                  ? pathname === "/reports"
                  : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeIfMobile}
              className={linkClass(active)}
            >
              {item.icon}
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 p-3 sm:p-4" ref={profileRef}>
        <div className="relative">
          <button
            type="button"
            id={`profile-trigger-${menuId}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? `profile-menu-${menuId}` : undefined}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-600 text-sm font-semibold text-white shadow-lg shadow-violet-900/30"
              aria-hidden
            >
              {initialsFromUser(user)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-white/90">Account</span>
              <span className="block truncate text-xs text-white/40">
                {user?.email ?? "…"}
              </span>
            </span>
            <svg
              className={`h-4 w-4 shrink-0 text-white/35 transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {menuOpen && (
            <div
              id={`profile-menu-${menuId}`}
              role="menu"
              aria-labelledby={`profile-trigger-${menuId}`}
              className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[min(20rem,50vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-[#12121a] py-1 shadow-xl shadow-black/50"
            >
              <div className="border-b border-white/10 px-3 py-2">
                <p className="text-xs text-white/35">Signed in as</p>
                <p className="break-all text-sm text-white/85">{user?.email ?? "—"}</p>
              </div>
              <Link
                href="/dashboard/settings"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  closeIfMobile();
                }}
                className="flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-white/45"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-sm text-red-400/90 hover:bg-red-500/10"
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
