"use client";

import { forwardRef, useState } from "react";
import type { PlannerTask } from "@/lib/daily-planner/types";

type Props = {
  tasks: PlannerTask[];
  /** Quick-add a new unscheduled task. */
  onCreate: (title: string) => void;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  /** Read-only mode for past days. */
  readOnly?: boolean;
};

export const UnscheduledRail = forwardRef<HTMLDivElement, Props>(function UnscheduledRail(
  { tasks, onCreate, onEdit, onDelete, onToggleDone, readOnly = false },
  ref
) {
  const [draft, setDraft] = useState("");

  const visible = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.order - b.order;
  });

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onCreate(t);
    setDraft("");
  };

  return (
    <div
      ref={ref}
      className="flex flex-col gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3"
    >
      <div className="flex items-center justify-between px-1 pt-1">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Unscheduled
        </h3>
        <span className="text-[10px] text-white/30 tabular-nums">{visible.length}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.length === 0 && (
          <p className="px-2 py-3 text-xs text-white/30">
            Nothing here. Add a task below or drag a block off the timeline to unschedule it.
          </p>
        )}

        {visible.map((t) => {
          return (
            <div
              key={t.id}
              data-unscheduled-task={readOnly ? undefined : true}
              data-task-id={t.id}
              data-task-title={t.title || "(untitled)"}
              className={`group flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition ${
                readOnly ? "" : "cursor-grab hover:border-violet-500/30 hover:bg-violet-500/5 active:cursor-grabbing"
              } ${t.done ? "opacity-50" : ""}`}
              title={readOnly ? undefined : "Drag onto timeline to schedule"}
            >
              <button
                type="button"
                disabled={readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) onToggleDone(t.id);
                }}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  t.done ? "border-violet-500/50 bg-violet-500/20" : "border-white/20 hover:border-white/40"
                }`}
                aria-label={t.done ? "Mark not done" : "Mark done"}
              >
                {t.done && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path
                      d="M1.5 4L3 5.5L6.5 2"
                      stroke="#a78bfa"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-snug ${t.done ? "line-through text-white/40" : "text-white/85"}`}>
                  {t.title || "(untitled)"}
                </p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-white/45 leading-snug line-clamp-2">
                    {t.description}
                  </p>
                )}
                {t.domainTags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.domainTags.slice(0, 3).map((d) => (
                      <span
                        key={d}
                        className="rounded-md border border-cyan-500/15 bg-cyan-950/30 px-1.5 py-0.5 text-[10px] text-cyan-400/70"
                      >
                        {d}
                      </span>
                    ))}
                    {t.domainTags.length > 3 && (
                      <span className="text-[10px] text-white/30">+{t.domainTags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              {!readOnly && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(t.id);
                    }}
                    className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white/85"
                    aria-label="Edit"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(t.id);
                    }}
                    className="rounded p-1 text-white/50 hover:bg-red-500/15 hover:text-red-300"
                    aria-label="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Add task…"
            className="flex-1 bg-transparent px-1 py-1 text-sm text-white/85 placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="rounded-lg bg-violet-600/80 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
});
