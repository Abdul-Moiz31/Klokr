"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DayData, PlannerGroup, PlannerTask } from "@/lib/daily-planner/types";
import { useSparkle } from "@/components/ui/SparkleEffect";
import { MIN_DURATION_MINUTES, normalizeRange } from "@/lib/daily-planner/timeline";

type Props = {
  data: DayData;
  onChange: (d: DayData) => void;
  newIdFn: () => string;
  /** When true, checkboxes are non-interactive and tasks are never marked done. */
  isTemplate?: boolean;
};

type Draft = {
  title: string;
  description: string;
  domains: string;
  /** "HH:MM" or "" */
  start: string;
  /** "HH:MM" or "" */
  end: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  domains: "",
  start: "",
  end: "",
});

function sortG(groups: PlannerGroup[]) {
  return [...groups].sort((a, b) => a.order - b.order);
}

function splitDomains(s: string) {
  return s
    .split(/[,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

function orderedTasksForGroup(tasks: PlannerTask[], groupId: string) {
  const inG = tasks.filter((t) => t.groupId === groupId);
  return [
    ...inG.filter((t) => !t.done).sort((a, b) => a.order - b.order),
    ...inG.filter((t) => t.done).sort((a, b) => a.order - b.order),
  ];
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

/**
 * From a draft's optional start/end strings, derive a valid range pair
 * (both null = unscheduled) or an error message. "" + "" = unscheduled (ok).
 * Anything else with one missing/invalid = error.
 */
function deriveRange(start: string, end: string):
  | { ok: true; startMinutes: number | null; endMinutes: number | null }
  | { ok: false; error: string } {
  const s = start.trim();
  const e = end.trim();
  if (!s && !e) return { ok: true, startMinutes: null, endMinutes: null };
  const sm = timeStringToMinutes(s);
  const em = timeStringToMinutes(e);
  if (sm == null || em == null) {
    return { ok: false, error: "Enter both start and end times (HH:MM)." };
  }
  if (em <= sm) {
    return { ok: false, error: `End must be at least ${MIN_DURATION_MINUTES} min after start.` };
  }
  const range = normalizeRange(sm, em);
  return { ok: true, startMinutes: range.start, endMinutes: range.end };
}

function formatDuration(start: number | null, end: number | null): string | null {
  if (start == null || end == null) return null;
  return `${end - start} min`;
}

export function DayDataEditor({ data, onChange, newIdFn, isTemplate = false }: Props) {
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { fire: fireSparkle } = useSparkle();

  const hasUnsaved = addingGroupId !== null || editingId !== null;
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const handleCheckboxClick = (e: React.MouseEvent, id: string, currentDone: boolean) => {
    if (!currentDone) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      fireSparkle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    onChange({
      ...data,
      tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: !currentDone } : t)),
    });
  };

  const setGroups = (groups: PlannerGroup[]) => onChange({ ...data, groups });
  const setTasks = (tasks: PlannerTask[]) => onChange({ ...data, tasks });

  const addGroup = () => {
    const max = data.groups.reduce((m, g) => Math.max(m, g.order), -1);
    setGroups([
      ...data.groups,
      { id: newIdFn(), title: "New group", order: max + 1 },
    ]);
  };

  const saveNewTask = (groupId: string) => {
    const title = draft.title.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    const range = deriveRange(draft.start, draft.end);
    if (!range.ok) {
      setError(range.error);
      return;
    }
    const inG = data.tasks.filter((t) => t.groupId === groupId);
    const maxO = inG.reduce((m, t) => Math.max(m, t.order), -1);
    setTasks([
      ...data.tasks,
      {
        id: newIdFn(),
        groupId,
        title,
        description: draft.description.trim(),
        done: false,
        domainTags: splitDomains(draft.domains),
        order: maxO + 1,
        startMinutes: range.startMinutes,
        endMinutes: range.endMinutes,
      },
    ]);
    setDraft(emptyDraft());
    setAddingGroupId(null);
    setError(null);
  };

  const updateTask = (id: string, patch: Partial<PlannerTask>) =>
    setTasks(data.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTask = (id: string) => {
    setTasks(data.tasks.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const moveTask = (groupId: string, taskId: string, dir: -1 | 1) => {
    const list = orderedTasksForGroup(data.tasks, groupId);
    const i = list.findIndex((t) => t.id === taskId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i]!;
    const b = list[j]!;
    setTasks(
      data.tasks.map((t) => {
        if (t.id === a.id) return { ...b, order: a.order };
        if (t.id === b.id) return { ...a, order: b.order };
        return t;
      })
    );
  };

  return (
    <div className="space-y-4">
      {sortG(data.groups).map((g) => {
        const tasks = orderedTasksForGroup(data.tasks, g.id);
        const doneCount = tasks.filter((t) => t.done).length;

        return (
          <div
            key={g.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-sm"
          >
            {/* Group header */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <input
                value={g.title}
                onChange={(e) =>
                  setGroups(
                    data.groups.map((x) =>
                      x.id === g.id ? { ...x, title: e.target.value } : x
                    )
                  )
                }
                className="flex-1 min-w-[8rem] bg-transparent text-sm font-semibold text-white/90 placeholder:text-white/30 focus:outline-none"
                placeholder="Group title"
              />
              {tasks.length > 0 && (
                <span className="text-[10px] font-medium text-white/30 tabular-nums">
                  {doneCount}/{tasks.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setTasks(data.tasks.filter((t) => t.groupId !== g.id));
                  setGroups(
                    data.groups
                      .filter((x) => x.id !== g.id)
                      .map((x, i) => ({ ...x, order: i }))
                  );
                }}
                className="text-xs text-white/25 hover:text-red-400/80 transition-colors"
              >
                Remove
              </button>
            </div>

            {/* Task list */}
            <div className="px-3 py-2 space-y-1">
              <AnimatePresence initial={false}>
                {tasks.map((t, i) => {
                  const isEditing = editingId === t.id;
                  const dur = formatDuration(t.startMinutes, t.endMinutes);
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {isEditing ? (
                        <EditTaskForm
                          task={t}
                          onSave={(patch) => {
                            updateTask(t.id, patch);
                            setEditingId(null);
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <div
                          className={`group flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04] ${
                            !isTemplate && t.done ? "opacity-55" : ""
                          }`}
                        >
                          <button
                            type="button"
                            aria-label={t.done ? "Mark pending" : "Mark done"}
                            onClick={(e) => {
                              if (!isTemplate) handleCheckboxClick(e, t.id, t.done);
                            }}
                            disabled={isTemplate}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              isTemplate
                                ? "border-white/15 cursor-default opacity-40"
                                : t.done
                                ? "border-violet-500/50 bg-violet-500/20"
                                : "border-white/25 hover:border-violet-400/60"
                            }`}
                          >
                            {!isTemplate && t.done && (
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

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm leading-snug ${
                                !isTemplate && t.done
                                  ? "line-through text-white/40"
                                  : "text-white/85"
                              }`}
                            >
                              {t.title || "—"}
                            </p>
                            {t.description && (
                              <p className="mt-0.5 text-xs text-white/45 leading-snug whitespace-pre-wrap">
                                {t.description}
                              </p>
                            )}
                            {(t.startMinutes != null || dur || t.domainTags.length > 0) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {t.startMinutes != null && t.endMinutes != null && (
                                  <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300/80 tabular-nums">
                                    {minutesToTimeString(t.startMinutes)} →{" "}
                                    {minutesToTimeString(t.endMinutes)}
                                  </span>
                                )}
                                {dur && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40 tabular-nums">
                                    {dur}
                                  </span>
                                )}
                                {t.domainTags.map((d) => (
                                  <span
                                    key={d}
                                    className="rounded-md border border-cyan-500/15 bg-cyan-950/30 px-1.5 py-0.5 text-[10px] text-cyan-400/70"
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => moveTask(g.id, t.id, -1)}
                              disabled={i === 0}
                              className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/70 disabled:opacity-20 transition-colors"
                              aria-label="Move up"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M5 2L9 7H1L5 2Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveTask(g.id, t.id, 1)}
                              disabled={
                                i === tasks.filter((x) => !x.done).length - 1 && !t.done
                              }
                              className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/70 disabled:opacity-20 transition-colors"
                              aria-label="Move down"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M5 8L1 3H9L5 8Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(t.id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-violet-400 transition-colors"
                              aria-label="Edit"
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 11 11"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                              >
                                <path d="M1.5 9.5h2L8 4l-2-2-4.5 4.5v2ZM7 3l1-1 1 1-1 1L7 3Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTask(t.id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-red-400 transition-colors"
                              aria-label="Delete"
                            >
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                              >
                                <path d="M2 2L8 8M8 2L2 8" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {tasks.length === 0 && addingGroupId !== g.id && (
                <p className="py-3 text-center text-xs text-white/20">No tasks yet</p>
              )}
            </div>

            {/* Add task */}
            <div className="border-t border-white/[0.05] px-3 py-2">
              <AnimatePresence>
                {addingGroupId === g.id ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5 py-2"
                  >
                    <input
                      value={draft.title}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNewTask(g.id);
                        if (e.key === "Escape") {
                          setAddingGroupId(null);
                          setDraft(emptyDraft());
                          setError(null);
                        }
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                      placeholder="Task title"
                      autoFocus
                    />
                    <textarea
                      value={draft.description}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, description: e.target.value }))
                      }
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 resize-none"
                      placeholder="Description (optional)"
                    />
                    <input
                      value={draft.domains}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, domains: e.target.value }))
                      }
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/90 focus:outline-none"
                      placeholder="Domains: github.com, notion.so (optional)"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-white/50">
                        Start
                        <input
                          type="time"
                          step={900}
                          value={draft.start}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, start: e.target.value }))
                          }
                          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-white/50">
                        End
                        <input
                          type="time"
                          step={900}
                          value={draft.end}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, end: e.target.value }))
                          }
                          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
                        />
                      </label>
                      {(() => {
                        const s = timeStringToMinutes(draft.start);
                        const e = timeStringToMinutes(draft.end);
                        if (s != null && e != null && e > s) {
                          return (
                            <span className="text-[11px] text-white/40 tabular-nums">
                              {e - s} min
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {error && (
                      <p className="text-xs text-amber-400/85">{error}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveNewTask(g.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600/80 text-white hover:bg-violet-500 transition-colors"
                      >
                        Add task
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingGroupId(null);
                          setDraft(emptyDraft());
                          setError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors border border-white/10 hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingGroupId(g.id);
                      setDraft(emptyDraft());
                      setError(null);
                    }}
                    className="flex items-center gap-1.5 text-xs text-white/35 hover:text-violet-400 transition-colors py-1"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <path d="M6 1v10M1 6h10" />
                    </svg>
                    Add task
                  </button>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addGroup}
        className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-sm text-white/40 hover:border-violet-500/30 hover:text-violet-400 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M7 1v12M1 7h12" />
        </svg>
        Add group
      </button>
    </div>
  );
}

function EditTaskForm({
  task,
  onSave,
  onCancel,
}: {
  task: PlannerTask;
  onSave: (patch: Partial<PlannerTask>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [domains, setDomains] = useState(task.domainTags.join(", "));
  const [start, setStart] = useState(minutesToTimeString(task.startMinutes));
  const [end, setEnd] = useState(minutesToTimeString(task.endMinutes));
  const [err, setErr] = useState<string | null>(null);

  const handleSave = () => {
    const t = title.trim();
    if (!t) {
      setErr("Title is required.");
      return;
    }
    const range = deriveRange(start, end);
    if (!range.ok) {
      setErr(range.error);
      return;
    }
    onSave({
      title: t,
      description: description.trim(),
      domainTags: splitDomains(domains),
      startMinutes: range.startMinutes,
      endMinutes: range.endMinutes,
    });
  };

  const s = timeStringToMinutes(start);
  const e = timeStringToMinutes(end);
  const liveDuration = s != null && e != null && e > s ? `${e - s} min` : null;

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 p-3 space-y-2.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
        placeholder="Task title"
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 resize-none"
        placeholder="Description (optional)"
      />
      <input
        value={domains}
        onChange={(e) => setDomains(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/90 focus:outline-none"
        placeholder="Domains: github.com, notion.so (optional)"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-white/55">
          Start
          <input
            type="time"
            step={900}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-white/55">
          End
          <input
            type="time"
            step={900}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
          />
        </label>
        {liveDuration && (
          <span className="text-[11px] text-white/40 tabular-nums">{liveDuration}</span>
        )}
      </div>
      {err && <p className="text-xs text-amber-400/85">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600/80 text-white hover:bg-violet-500"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors border border-white/10 hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
