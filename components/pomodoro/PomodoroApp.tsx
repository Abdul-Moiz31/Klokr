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

// Classic Pomodoro cadence: after every 4th completed focus session, take a
// long break instead of a short one.
const FOCUS_CYCLES_BEFORE_LONG_BREAK = 4;

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
const TIMER_KEY = "Klokrs_pomodoro_timer";

// The countdown is anchored to a real wall-clock deadline (epoch ms) rather
// than decremented tick-by-tick, and persisted on every change. Two bugs
// this fixes in one move:
//   1. A tick-counted timer that only lives in React state loses all
//      progress on refresh/navigation, with no warning.
//   2. Browsers throttle setInterval in backgrounded tabs (sometimes to
//      ~1 tick/minute) — a tick-counted timer reads much longer than real
//      elapsed time after switching away and back. A deadline-based timer
//      always recomputes the true remaining time from Date.now() on every
//      read, so throttling can only delay *noticing* zero, never distort
//      what's displayed before that.
type TimerState = {
  mode: Mode;
  isRunning: boolean;
  /** Epoch ms the countdown reaches 0 — meaningful only while isRunning. */
  deadline: number | null;
  /** Seconds left — meaningful only while paused. */
  pausedRemaining: number;
  /** DEFAULTS[mode] baseline, extended by +time clicks. Drives the "over
   *  time" indicator, kept separate from the ring's fixed 100% reference. */
  totalForMode: number;
  focusCyclesCompleted: number;
};

function freshState(mode: Mode, focusCyclesCompleted: number): TimerState {
  return {
    mode,
    isRunning: false,
    deadline: null,
    pausedRemaining: DEFAULTS[mode],
    totalForMode: DEFAULTS[mode],
    focusCyclesCompleted,
  };
}

function loadTimerState(): TimerState {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(TIMER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TimerState>;
        if (parsed.mode && DEFAULTS[parsed.mode] != null) {
          return {
            mode: parsed.mode,
            isRunning: Boolean(parsed.isRunning),
            deadline: typeof parsed.deadline === "number" ? parsed.deadline : null,
            pausedRemaining:
              typeof parsed.pausedRemaining === "number" ? parsed.pausedRemaining : DEFAULTS[parsed.mode],
            totalForMode:
              typeof parsed.totalForMode === "number" ? parsed.totalForMode : DEFAULTS[parsed.mode],
            focusCyclesCompleted:
              typeof parsed.focusCyclesCompleted === "number" ? parsed.focusCyclesCompleted : 0,
          };
        }
      }
    } catch { /* ignore */ }
  }
  return freshState("focus", 0);
}

function saveTimerState(s: TimerState) {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(s)); }
  catch { /* ignore */ }
}

function remainingFor(state: TimerState, nowMs: number): number {
  if (state.isRunning && state.deadline != null) {
    return Math.max(0, Math.ceil((state.deadline - nowMs) / 1000));
  }
  return Math.max(0, state.pausedRemaining);
}

export function PomodoroApp() {
  const [timer, setTimer] = useState<TimerState>(() => loadTimerState());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const completionHandledRef = useRef(false);
  const { fire: fireSparkle } = useSparkle();

  useEffect(() => { saveTimerState(timer); }, [timer]);

  // Header clock — cosmetic display only, unrelated to the countdown itself,
  // so a coarse 30s tick is fine here.
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

  const { mode, isRunning, totalForMode } = timer;
  const baseTotal = DEFAULTS[mode];
  const remaining = remainingFor(timer, nowMs);

  // Auto-advances mode on natural completion, following the classic 4-focus-
  // sessions -> long-break cadence — a focus session completing rolls the
  // cycle counter and picks short/long break accordingly; a break completing
  // always returns to focus. The next mode is loaded but not auto-started,
  // matching the existing "switch mode" behavior elsewhere in this component.
  const advanceAfterCompletion = useCallback(() => {
    setTimer((s) => {
      if (s.mode === "focus") {
        const cycles = s.focusCyclesCompleted + 1;
        const nextMode: Mode = cycles % FOCUS_CYCLES_BEFORE_LONG_BREAK === 0 ? "long" : "short";
        return freshState(nextMode, cycles);
      }
      return freshState("focus", s.focusCyclesCompleted);
    });
  }, []);

  // Ticks once a second while running purely to trigger a re-render so
  // `remaining` (derived from the real deadline above) updates on screen and
  // natural completion can be detected — the displayed value never comes
  // from this interval's own counting.
  useEffect(() => {
    if (!isRunning) { completionHandledRef.current = false; return; }
    tickRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || completionHandledRef.current) return;
    if (remaining > 0) return;
    completionHandledRef.current = true;
    beep();
    if (typeof document !== "undefined") document.title = "Klokrs — Dashboard";
    advanceAfterCompletion();
  }, [isRunning, remaining, beep, advanceAfterCompletion]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isRunning) { document.title = "Klokrs — Dashboard"; return; }
    document.title = `${formatHms(remaining)} — ${MODE_LABEL[mode]}`;
  }, [isRunning, remaining, mode]);

  const ringCirc = 2 * Math.PI * 44;
  // Scaled against the mode's fixed base duration, not the +time-extended
  // total — so the ring's 100% mark always means "the original planned
  // length" and stays put instead of silently rescaling every time the user
  // adds time (which previously made it look like the session was always on
  // track, even well past its original allotment).
  const remainingRatio = useMemo(() => {
    if (baseTotal <= 0) return 0;
    return Math.max(0, Math.min(1, remaining / baseTotal));
  }, [remaining, baseTotal]);
  // Over time once *actually elapsed* time (not just total allotment,
  // including any padding added before it was needed) exceeds the mode's
  // original length — clicking "+10m" the instant a session starts
  // shouldn't immediately claim you're over time; only really running past
  // the original 25 minutes should.
  const elapsed = totalForMode - remaining;
  const overTimeSeconds = Math.max(0, elapsed - baseTotal);

  const switchMode = (m: Mode) => {
    setTimer((s) => freshState(m, s.focusCyclesCompleted));
  };

  const toggleRunning = () => {
    setTimer((s) => {
      if (s.isRunning) {
        // Pause: freeze whatever the real elapsed-time-derived remaining is
        // right now, rather than trusting any in-flight tick counter.
        return { ...s, isRunning: false, deadline: null, pausedRemaining: remainingFor(s, Date.now()) };
      }
      // Resume/start: anchor a fresh deadline from the current remaining.
      const startFrom = remainingFor(s, Date.now());
      return { ...s, isRunning: true, deadline: Date.now() + startFrom * 1000 };
    });
  };

  const addSeconds = (sec: number) => {
    setTimer((s) => {
      if (s.isRunning && s.deadline != null) {
        return { ...s, deadline: s.deadline + sec * 1000, totalForMode: s.totalForMode + sec };
      }
      return { ...s, pausedRemaining: s.pausedRemaining + sec, totalForMode: s.totalForMode + sec };
    });
  };

  const resetMode = () => {
    setTimer((s) => freshState(s.mode, s.focusCyclesCompleted));
  };

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

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
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
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 mb-2">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke={overTimeSeconds > 0 ? "#F59E0B" : "url(#ringGrad)"}
                strokeWidth="3" strokeLinecap="round"
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

          {/* Over-time indicator — a persistent, explicit signal that extra
              time has been added beyond this mode's planned length, instead
              of the ring silently rescaling its own 100% mark. */}
          <div className="h-5 mb-3">
            {overTimeSeconds > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                +{formatHms(overTimeSeconds)} over planned length
              </span>
            )}
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
            onClick={toggleRunning}
            className={`px-12 py-3 rounded-xl text-base font-semibold transition-all ${
              isRunning
                ? "bg-white/[0.08] text-white border border-white/15 hover:bg-white/[0.12]"
                : "bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_28px_rgba(124,58,237,0.4)]"
            }`}
          >
            {isRunning ? "Pause" : "Start"}
          </button>
          {(remaining !== baseTotal || totalForMode !== baseTotal) && !isRunning && (
            <button
              type="button"
              onClick={resetMode}
              className="mt-2.5 text-sm text-white/35 hover:text-white/60 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* ── Task panel ── */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
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
