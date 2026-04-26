"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { createClient } from "@/lib/supabase";
import { AppShell } from "@/components/dashboard/AppShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Loader } from "@/components/ui/Loader";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type KlokrPrefs } from "@/lib/prefs";
import type { User } from "@supabase/supabase-js";

/* ─── Primitives ─────────────────────────────────────────── */

function SectionTitle({ children, tooltip }: { children: ReactNode; tooltip?: string }) {
  return (
    <div className="mb-4 flex items-center gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{children}</p>
      {tooltip && <InfoTooltip text={tooltip} side="bottom" />}
    </div>
  );
}

function PrefRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 py-3.5 border-b border-white/[0.05] last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/80">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-white/35">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-lg shadow-black/20">
      <div className="px-5 py-1 sm:px-6">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 focus:outline-none ${
        checked ? "border-violet-500/50 bg-violet-600" : "border-white/15 bg-white/10"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 self-center rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ChipSelect<T extends number | string>({
  options,
  value,
  format,
  onChange,
}: {
  options: T[];
  value: T;
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o
              ? "bg-violet-600/80 text-white border border-violet-500/40"
              : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

/* ─── Export ─────────────────────────────────────────────── */

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Tab definitions ────────────────────────────────────── */

const TABS = [
  {
    id: "general",
    label: "General",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    id: "security",
    label: "Security",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    id: "data",
    label: "Data",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ─── Page ───────────────────────────────────────────────── */

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [prefs, setPrefs] = useState<KlokrPrefs>(DEFAULT_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");

  const [exportRange, setExportRange] = useState<"today" | "week" | "month">("week");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    setPrefs(loadPrefs());
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
    else setNotifPermission("unsupported");
  }, []);

  const updatePrefs = (patch: Partial<KlokrPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
      return next;
    });
  };

  const handleChangePassword = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (password.length < 8) { setPasswordMsg({ type: "err", text: "Use at least 8 characters." }); return; }
    if (password !== passwordConfirm) { setPasswordMsg({ type: "err", text: "Passwords do not match." }); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setPasswordMsg({ type: "err", text: error.message }); return; }
    setPassword(""); setPasswordConfirm("");
    setPasswordMsg({ type: "ok", text: "Password updated." });
  };

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    setExportMsg(null);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    let fromDate = todayStr;
    if (exportRange === "week") {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      fromDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    } else if (exportRange === "month") {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      fromDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tab_sessions")
      .select("date, domain, page_title, duration_seconds, visits, start_time, end_time")
      .eq("user_id", user.id)
      .gte("date", fromDate)
      .lte("date", todayStr)
      .order("date", { ascending: false })
      .order("duration_seconds", { ascending: false });
    setExporting(false);
    if (error || !data) { setExportMsg("Export failed: " + (error?.message ?? "no data")); return; }
    if (data.length === 0) { setExportMsg("No data in this range."); return; }
    downloadCSV(toCSV(data as Record<string, unknown>[]), `klokr-export-${exportRange}-${todayStr}.csv`);
    setExportMsg(`Exported ${data.length} rows.`);
  };

  if (loading) {
    return (
      <AppShell title="Settings" contentMaxClassName="max-w-2xl">
        <Loader />
      </AppShell>
    );
  }

  const formatHour = (h: number) => h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;

  return (
    <AppShell title="Settings" contentMaxClassName="max-w-2xl">
      <PageHeader eyebrow="Account" title="Settings" />

      {/* Tab bar */}
      <div className="mb-7 flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative flex flex-1 min-w-max items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-violet-600/25 text-violet-200 shadow-sm"
                  : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
              }`}
            >
              <span className={isActive ? "text-violet-300/80" : "text-white/30"}>
                {t.icon}
              </span>
              {t.label}
              {isActive && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className="absolute inset-0 rounded-xl border border-violet-500/20"
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="space-y-5"
        >

          {/* ── General ── */}
          {activeTab === "general" && (
            <>
              <div>
                <SectionTitle tooltip="Your Klokr account details. Tab data is tied to this email address.">Account</SectionTitle>
                <Card>
                  <PrefRow label="Email">
                    <span className="text-sm text-white/70 break-all">{user?.email ?? "—"}</span>
                  </PrefRow>
                  <PrefRow label="User ID" hint="Unique identifier for your account">
                    <span className="font-mono text-xs text-white/35 break-all">{user?.id ?? "—"}</span>
                  </PrefRow>
                  <PrefRow label="Joined" hint="Account creation date">
                    <span className="text-sm text-white/55">
                      {user?.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "—"}
                    </span>
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Steps to get the Chrome extension working correctly with your account.">Extension setup</SectionTitle>
                <Card>
                  <div className="py-3 space-y-3">
                    {[
                      "Keep this tab signed in so the extension can read your auth session.",
                      "Pin the Klokr icon from your Chrome extensions menu for quick access.",
                      "Browse in a normal window (not Incognito) for sessions to be tracked.",
                      "The extension syncs every ~60 seconds and when you switch tabs.",
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-white/50">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-300">
                          {i + 1}
                        </span>
                        {tip}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* ── Security ── */}
          {activeTab === "security" && (
            <div>
              <SectionTitle tooltip="Change your Klokr login password. Must be at least 8 characters.">Password</SectionTitle>
              <Card>
                <form onSubmit={handleChangePassword} className="py-3 space-y-4 max-w-sm">
                  <PasswordInput
                    label="New password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                  />
                  <PasswordInput
                    label="Confirm new password"
                    value={passwordConfirm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                  {passwordMsg && (
                    <p className={`text-sm ${passwordMsg.type === "ok" ? "text-emerald-400/90" : "text-red-400/90"}`}>
                      {passwordMsg.text}
                    </p>
                  )}
                  <Button type="submit" disabled={saving} variant="primary">
                    {saving ? "Saving…" : "Update password"}
                  </Button>
                </form>
              </Card>
            </div>
          )}

          {/* ── Preferences ── */}
          {activeTab === "preferences" && (
            <>
              {prefsSaved && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-2.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p className="text-xs text-emerald-400/90">Preferences saved automatically.</p>
                </div>
              )}

              <div>
                <SectionTitle tooltip="Define what a productive day looks like — used to colour the Activity heatmap and calculate your streak.">Productivity</SectionTitle>
                <Card>
                  <PrefRow
                    label="Productive day threshold"
                    hint="Days where you track at least this many hours are marked productive on the Activity heatmap"
                  >
                    <ChipSelect
                      options={[2, 3, 4, 5, 6, 8] as number[]}
                      value={prefs.productiveHoursThreshold}
                      format={(v) => `${v as number}h`}
                      onChange={(v) => updatePrefs({ productiveHoursThreshold: v as number })}
                    />
                  </PrefRow>
                  <PrefRow label="Equivalent minutes">
                    <span className="text-sm text-white/40 tabular-nums">
                      {prefs.productiveHoursThreshold * 60} min / day
                    </span>
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Your typical workday window — used to calculate what percentage of working time was actively tracked.">Working hours</SectionTitle>
                <Card>
                  <PrefRow label="Day starts at">
                    <ChipSelect
                      options={[6, 7, 8, 9, 10] as number[]}
                      value={prefs.workStartHour}
                      format={formatHour}
                      onChange={(v) => updatePrefs({ workStartHour: v as number })}
                    />
                  </PrefRow>
                  <PrefRow label="Day ends at">
                    <ChipSelect
                      options={[16, 17, 18, 19, 20, 21] as number[]}
                      value={prefs.workEndHour}
                      format={formatHour}
                      onChange={(v) => updatePrefs({ workEndHour: v as number })}
                    />
                  </PrefRow>
                  <PrefRow label="Effective window">
                    <span className="text-sm text-white/40 tabular-nums">
                      {prefs.workEndHour - prefs.workStartHour}h per day
                    </span>
                  </PrefRow>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="Fine-tune how the extension counts sessions. Changes apply the next time the extension syncs.">Tracking</SectionTitle>
                <Card>
                  <PrefRow label="Minimum session duration" hint="Sessions shorter than this are ignored">
                    <ChipSelect
                      options={[5, 10, 15, 30] as number[]}
                      value={prefs.minSessionSeconds}
                      format={(v) => `${v as number}s`}
                      onChange={(v) => updatePrefs({ minSessionSeconds: v as number })}
                    />
                  </PrefRow>
                  <PrefRow label="Idle timeout" hint="Mark session idle after this long without activity">
                    <ChipSelect
                      options={[1, 2, 5, 10] as number[]}
                      value={prefs.idleTimeoutMinutes}
                      format={(v) => `${v as number}m`}
                      onChange={(v) => updatePrefs({ idleTimeoutMinutes: v as number })}
                    />
                  </PrefRow>
                </Card>
              </div>
            </>
          )}

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <div>
              <SectionTitle tooltip="Browser notifications let Klokr alert you when a focus session ends or your workday summary is ready.">Browser notifications</SectionTitle>
              <Card>
                <PrefRow
                  label="Permission"
                  hint={
                    notifPermission === "granted"
                      ? "Klokr can send you browser alerts."
                      : notifPermission === "denied"
                        ? "Permission denied — reset in your browser settings."
                        : notifPermission === "unsupported"
                          ? "Not supported in this browser."
                          : "Grant permission to receive focus and summary alerts."
                  }
                >
                  {notifPermission === "granted" ? (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                      Granted
                    </span>
                  ) : notifPermission === "denied" ? (
                    <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
                      Denied
                    </span>
                  ) : notifPermission === "unsupported" ? (
                    <span className="text-xs text-white/30">Not available</span>
                  ) : (
                    <button
                      type="button"
                      onClick={requestNotifications}
                      className="rounded-lg border border-violet-500/30 bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-600/35 transition-colors"
                    >
                      Request permission
                    </button>
                  )}
                </PrefRow>
                <PrefRow label="Daily summary" hint="Notification with your total tracked time at end of working day">
                  <Toggle
                    checked={prefs.dailySummaryEnabled}
                    onChange={(v) => updatePrefs({ dailySummaryEnabled: v })}
                  />
                </PrefRow>
              </Card>
            </div>
          )}

          {/* ── Data ── */}
          {activeTab === "data" && (
            <>
              <div>
                <SectionTitle tooltip="Download your raw session data as CSV — domain, page title, start/end time, duration, and visit count.">Export</SectionTitle>
                <Card>
                  <PrefRow label="Date range" hint="Time window to include in the CSV export">
                    <ChipSelect
                      options={["today", "week", "month"] as const}
                      value={exportRange}
                      format={(v) => v === "today" ? "Today" : v === "week" ? "Last 7 days" : "Last 30 days"}
                      onChange={(v) => setExportRange(v as typeof exportRange)}
                    />
                  </PrefRow>
                  <div className="py-3 flex flex-col items-start gap-2.5">
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={exporting}
                      className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white transition-all disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 1v8M4 6l3 3 3-3M2 10v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
                      </svg>
                      {exporting ? "Exporting…" : "Download CSV"}
                    </button>
                    {exportMsg && (
                      <p className={`text-xs ${exportMsg.startsWith("Export failed") ? "text-red-400/80" : "text-emerald-400/80"}`}>
                        {exportMsg}
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              <div>
                <SectionTitle tooltip="A summary of exactly what data Klokr records — and what it never touches.">What we store</SectionTitle>
                <Card>
                  <div className="py-3 space-y-2.5 text-sm text-white/50 leading-relaxed">
                    <p>One row per tab session: domain, page title, start/end time, duration, and visit count.</p>
                    <p>No page content, keystrokes, or personal information is ever collected.</p>
                    <p>Full account deletion is available by contacting support.</p>
                  </div>
                </Card>
              </div>
            </>
          )}

        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
