"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS, TOUR_STORAGE_KEY, TOUR_START_EVENT } from "@/lib/tour";

type Rect = { top: number; left: number; width: number; height: number };

function rectFor(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tour() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = active ? TOUR_STEPS[stepIndex] : undefined;

  // First-time auto-start, gated on actually being inside the app shell
  // (this component only mounts there) and never having finished the tour.
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
        setActive(true);
        setStepIndex(0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const onStart = () => { setActive(true); setStepIndex(0); };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    try { localStorage.setItem(TOUR_STORAGE_KEY, "1"); } catch { /* ignore */ }
  }, []);

  // Locate (and keep tracking) the current step's target element.
  useEffect(() => {
    if (!active || !step) return;
    if (pollRef.current) clearInterval(pollRef.current);

    // Step needs a different page — navigate, then this effect re-runs once pathname matches.
    if (step.route && pathname !== step.route) {
      router.push(`${step.route}${step.routeQuery ?? ""}`);
      setRect(null);
      return;
    }

    let attempts = 0;
    pollRef.current = setInterval(() => {
      const el = document.querySelector(`[data-tour="${step.id}"]`);
      if (el) {
        setRect(rectFor(el));
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (++attempts > 40) {
        // Target never showed up (e.g. settings tab content not yet mounted) — give up on this step.
        if (pollRef.current) clearInterval(pollRef.current);
        if (stepIndex + 1 < TOUR_STEPS.length) setStepIndex(stepIndex + 1);
        else finish();
      }
    }, 100);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active, step, pathname, router, finish]);

  // Keep the highlight glued to its target across scroll/resize.
  useEffect(() => {
    if (!active || !step) return;
    const reposition = () => {
      const el = document.querySelector(`[data-tour="${step.id}"]`);
      if (el) setRect(rectFor(el));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [active, step]);

  if (!active || !step || !rect) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const pad = 6;
  const spotlight: Rect = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  const placement = step.placement ?? "bottom";
  const tooltipStyle =
    placement === "right"
      ? { top: spotlight.top, left: spotlight.left + spotlight.width + 14 }
      : placement === "left"
        ? { top: spotlight.top, left: Math.max(14, spotlight.left - 322) }
        : { top: spotlight.top + spotlight.height + 14, left: Math.min(spotlight.left, window.innerWidth - 330) };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Dimmed backdrop with a spotlight cutout over the target */}
      <div
        className="pointer-events-none fixed rounded-lg ring-2 ring-violet-400/80 transition-all duration-200"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          boxShadow: "0 0 0 9999px rgba(5,5,8,0.72)",
        }}
      />

      {/* Tooltip card */}
      <div
        className="fixed z-[101] w-[300px] rounded-xl border border-white/10 bg-[#13131c] p-4 shadow-2xl shadow-black/60 transition-all duration-200"
        style={tooltipStyle}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">
            {stepIndex + 1} / {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-[11px] text-white/35 transition hover:text-white/70"
          >
            Skip tour
          </button>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-white/95">{step.title}</h3>
        <p className="mb-3 text-xs leading-relaxed text-white/55">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/45 transition hover:bg-white/5 hover:text-white/80 disabled:opacity-0"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
            className="rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
