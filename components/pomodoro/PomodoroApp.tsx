"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSparkle } from "@/components/ui/SparkleEffect";

type Mode = "focus" | "short" | "long";

const DEFAULTS: Record<Mode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};

function formatHms(total: number) {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function formatClock(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

type Task = { id: string; text: string; done: boolean };

const TASKS_KEY = "Klokrs_pomodoro_tasks";

export function PomodoroApp() {
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(DEFAULTS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const totalForMode = DEFAULTS[mode];
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const { fire: fireSparkle } = useSparkle();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Task[];
        if (Array.isArray(parsed)) setTasks(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
    catch { /* ignore */ }
  }, [tasks]);

  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioRef.current ?? new Ctx();
      audioRef.current = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.2);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          beep();
          setIsRunning(false);
          if (typeof document !== "undefined") document.title = "Klokrs — Dashboard";
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRunning, beep]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isRunning) { document.title = "Klokrs — Dashboard"; return; }
    document.title = `${formatHms(remaining)} — ${MODE_LABEL[mode]}`;
  }, [isRunning, remaining, mode]);

  const ringCirc = 2 * Math.PI * 44;
  const remainingRatio = useMemo(() => {
    const scale = Math.max(totalForMode, remaining);
    if (scale <= 0) return 0;
    return Math.max(0, Math.min(1, remaining / scale));
  }, [remaining, totalForMode]);

  const switchMode = (m: Mode) => {
    if (isRunning) setIsRunning(false);
    setMode(m);
    setRemaining(DEFAULTS[m]);
  };

  const addSeconds = (sec: number) => setRemaining((r) => r + sec);

  const toggleTask = (id: string) =>
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const removeTask = (id: string) =>
    setTasks((list) => list.filter((t) => t.id !== id));

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    const t = newTask.trim();
    if (!t) return;
    setTasks((list) => [...list, { id: crypto.randomUUID(), text: t, done: false }]);
    setNewTask("");
  };

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="w-full max-w-5xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 text-xs text-white/40">
        <span className="font-medium text-white/50">{formatDate(now)}</span>
        <span className="tabular-nums font-semibold text-white/70">{formatClock(now)}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {/* ── Timer column ── */}
        <div className="flex-1 flex flex-col items-center">
          {/* Mode selector */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
            {(["focus", "short", "long"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-violet-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.35)]"
                    : "text-white/45 hover:text-white/80"
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {/* Timer ring */}
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 mb-5">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke="url(#ringGrad)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${ringCirc * remainingRatio} ${ringCirc}`}
                className="transition-[stroke-dasharray] duration-1000 ease-linear"
              />
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-4xl sm:text-5xl font-mono font-bold tabular-nums tracking-tight text-white">
                {formatHms(remaining)}
              </span>
              <span className="text-xs font-medium text-white/35 uppercase tracking-widest">
                {MODE_LABEL[mode]}
              </span>
            </div>
          </div>

          {/* Add time */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-5">
            {([
              [25 * 60, "+25m"],
              [10 * 60, "+10m"],
              [5 * 60, "+5m"],
              [60, "+1m"],
            ] as const).map(([sec, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => addSeconds(sec)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] text-white/55 hover:bg-white/10 hover:text-white/80 border border-white/[0.08] transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Start / Pause */}
          <button
            type="button"
            onClick={() => setIsRunning((r) => !r)}
            className={`px-12 py-3 rounded-2xl text-base font-semibold transition-all ${
              isRunning
                ? "bg-white/[0.08] text-white border border-white/15 hover:bg-white/[0.12]"
                : "bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_28px_rgba(124,58,237,0.4)]"
            }`}
          >
            {isRunning ? "Pause" : "Start"}
          </button>
          {remaining !== totalForMode && !isRunning && (
            <button
              type="button"
              onClick={() => setRemaining(DEFAULTS[mode])}
              className="mt-2.5 text-sm text-white/35 hover:text-white/60 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* ── Task panel ── */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Session tasks
              </span>
              <span className="text-xs tabular-nums text-white/30">
                {pending.length} left
              </span>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-56 lg:max-h-80 pr-0.5">
              {pending.map((t) => (
                <div
                  key={t.id}
                  className="group flex items-start gap-2.5 rounded-lg px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <button
                    type="button"
                    aria-label="Mark done"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      fireSparkle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                      toggleTask(t.id);
                    }}
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/25 hover:border-violet-400/60 transition-colors"
                  />
                  <span className="flex-1 min-w-0 text-sm text-white/80 break-words leading-snug">
                    {t.text}
                  </span>
                </div>
              ))}

              {done.length > 0 && (
                <>
                  <p className="pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                    Completed
                  </p>
                  {done.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-start gap-2.5 rounded-lg px-3 py-2 opacity-50 hover:opacity-70 transition-opacity"
                    >
                      <button
                        type="button"
                        aria-label="Mark pending"
                        onClick={() => toggleTask(t.id)}
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-violet-500/50 bg-violet-500/20"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3 5.5L6.5 2" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <span className="flex-1 min-w-0 text-sm text-white/50 line-through break-words leading-snug">
                        {t.text}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove task"
                        onClick={() => removeTask(t.id)}
                        className="mt-0.5 hidden group-hover:block text-white/25 hover:text-red-400 transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </>
              )}

              {tasks.length === 0 && (
                <p className="text-center text-white/25 text-xs py-6">
                  No tasks — add one below
                </p>
              )}
            </div>

            {/* Add task */}
            <form onSubmit={addTask} className="flex gap-2 pt-1 border-t border-white/[0.06]">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Add a task…"
                className="flex-1 min-w-0 px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-colors"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-violet-600/70 text-white hover:bg-violet-500/80 transition-colors shrink-0"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
