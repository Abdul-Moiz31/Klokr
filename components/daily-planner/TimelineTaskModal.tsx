"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { PlannerTask, RoutineTemplateKind } from "@/lib/daily-planner/types";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  MIN_DURATION_MINUTES,
  SNAP_MINUTES,
  formatMinutes,
  normalizeRange,
} from "@/lib/daily-planner/timeline";

export type TimelineTaskDraft = {
  title: string;
  description: string;
  done: boolean;
  domainTags: string[];
  blockedDomainTags: string[];
  startMinutes: number | null;
  endMinutes: number | null;
  /**
   * Set true when the user picked "Apply to template" in the A1 confirm dialog.
   * Only meaningful when editing an instance that has template lineage and the
   * user changed `domainTags`. Parent uses this to also patch the template.
   */
  applyDomainsToTemplate?: boolean;
};

const TEMPLATE_LABELS: Record<RoutineTemplateKind, string> = {
  weekdays: "Weekdays",
  saturday: "Saturday",
  sunday: "Sunday",
  fallback: "Fallback",
};

function sameDomainSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const d of b) if (!sa.has(d)) return false;
  return true;
}

type Props = {
  /** When editing: the existing task. When creating: null. */
  initial: PlannerTask | null;
  /** Pre-fill the time range on create (from drag-to-select). */
  initialRange?: { start: number; end: number };
  onSave: (draft: TimelineTaskDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
};

function splitDomains(s: string) {
  return s
    .split(/[,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

function minutesToTimeString(m: number | null): string {
  if (m == null) return "";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeStringToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function TimelineTaskModal({ initial, initialRange, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [done, setDone] = useState(initial?.done ?? false);
  const [domains, setDomains] = useState<string>(initial?.domainTags.join(", ") ?? "");
  const [blockedDomains, setBlockedDomains] = useState<string>(
    initial?.blockedDomainTags?.join(", ") ?? ""
  );
  const [scheduled, setScheduled] = useState<boolean>(
    initial ? initial.startMinutes != null : Boolean(initialRange)
  );
  const [startStr, setStartStr] = useState<string>(
    minutesToTimeString(initial?.startMinutes ?? initialRange?.start ?? null)
  );
  const [endStr, setEndStr] = useState<string>(
    minutesToTimeString(initial?.endMinutes ?? initialRange?.end ?? null)
  );
  // Captured once on mount so we can detect "domains changed" reliably.
  const originalDomains = useMemo(() => initial?.domainTags ?? [], [initial]);
  const [pendingDraft, setPendingDraft] = useState<TimelineTaskDraft | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = () => {
    const t = title.trim();
    if (!t) return;

    let startMinutes: number | null = null;
    let endMinutes: number | null = null;
    if (scheduled) {
      const s = timeStringToMinutes(startStr);
      const e = timeStringToMinutes(endStr);
      if (s == null || e == null) return;
      const range = normalizeRange(s, e);
      startMinutes = range.start;
      endMinutes = range.end;
    }

    const draft: TimelineTaskDraft = {
      title: t,
      description: description.trim(),
      done,
      domainTags: splitDomains(domains),
      blockedDomainTags: splitDomains(blockedDomains),
      startMinutes,
      endMinutes,
    };

    // A1 confirm dialog: editing an instance with template lineage and the
    // domain set has changed → ask whether to also update the template.
    const hasLineage = Boolean(initial?.sourceTemplateTaskId && initial?.sourceTemplateKind);
    const domainsChanged = !sameDomainSet(originalDomains, draft.domainTags);
    if (initial && hasLineage && domainsChanged) {
      setPendingDraft(draft);
      return;
    }

    onSave(draft);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f0f16] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold text-white">
          {initial ? "Edit task" : "New task"}
        </h3>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs text-white/45">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              autoFocus
              placeholder="e.g. Deep work — onboarding flow"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-violet-500/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-white/45">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional notes about this task"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 placeholder:text-white/30 focus:border-violet-500/40 focus:outline-none resize-none"
            />
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={scheduled}
                onChange={(e) => setScheduled(e.target.checked)}
                className="accent-violet-500"
              />
              Schedule on timeline
            </label>
            {scheduled && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-white/45">Start</span>
                    <input
                      type="time"
                      step={SNAP_MINUTES * 60}
                      value={startStr}
                      onChange={(e) => setStartStr(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90 focus:border-violet-500/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-white/45">End</span>
                    <input
                      type="time"
                      step={SNAP_MINUTES * 60}
                      value={endStr}
                      onChange={(e) => setEndStr(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90 focus:border-violet-500/40 focus:outline-none"
                    />
                  </div>
                </div>
                {(() => {
                  const s = timeStringToMinutes(startStr);
                  const e = timeStringToMinutes(endStr);
                  if (s == null || e == null) {
                    return (
                      <p className="mt-2 text-xs text-amber-400/70">
                        Enter times like 09:00 and 10:30.
                      </p>
                    );
                  }
                  if (e <= s) {
                    return (
                      <p className="mt-2 text-xs text-amber-400/70">
                        End must be at least {MIN_DURATION_MINUTES} min after start.
                      </p>
                    );
                  }
                  return (
                    <p className="mt-2 text-xs text-white/40 tabular-nums">
                      {formatMinutes(s)} → {formatMinutes(e)} · {e - s} min
                    </p>
                  );
                })()}
              </>
            )}
          </div>

          {initial && (
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => setDone(e.target.checked)}
                className="accent-violet-500"
              />
              Mark done
            </label>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-xs text-white/45">
              Domains (tab time)
              <InfoTooltip text="Tracked for this task's progress bar. Only time spent on these domains during the scheduled window counts toward completion — everything else you browse is still recorded elsewhere, just not credited to this task." />
            </label>
            <input
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90 focus:border-violet-500/40 focus:outline-none"
              placeholder="github.com, notion.so"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs text-white/45">
              Blocked domains (optional)
              <InfoTooltip text="Blocked for the duration of this task's window, regardless of the extension's global Focus Mode toggle. e.g. block youtube.com during a Reading block even if Focus Mode is off elsewhere." />
            </label>
            <input
              value={blockedDomains}
              onChange={(e) => setBlockedDomains(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90 focus:border-violet-500/40 focus:outline-none"
              placeholder="youtube.com, reddit.com"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="rounded-xl border border-red-500/25 px-3 py-2.5 text-sm text-red-300/85 transition hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:text-white/85"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {initial ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </motion.div>

      {pendingDraft && initial?.sourceTemplateKind && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f0f16] p-6 shadow-2xl"
          >
            <h3 className="mb-2 text-base font-semibold text-white">Domain tags changed</h3>
            <p className="mb-5 text-sm leading-relaxed text-white/55">
              Apply the new tags to this instance only, or also update the
              <span className="px-1 font-medium text-white/85">
                {TEMPLATE_LABELS[initial.sourceTemplateKind]}
              </span>
              template so future days inherit them?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onSave({ ...pendingDraft, applyDomainsToTemplate: true });
                  setPendingDraft(null);
                }}
                className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                Apply to {TEMPLATE_LABELS[initial.sourceTemplateKind]} template
              </button>
              <button
                type="button"
                onClick={() => {
                  onSave({ ...pendingDraft, applyDomainsToTemplate: false });
                  setPendingDraft(null);
                }}
                className="w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.04]"
              >
                Apply to today only
              </button>
              <button
                type="button"
                onClick={() => setPendingDraft(null)}
                className="w-full px-4 py-2 text-xs text-white/40 transition hover:text-white/65"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
