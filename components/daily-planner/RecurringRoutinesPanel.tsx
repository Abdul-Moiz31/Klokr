"use client";

import { useEffect, useRef, useState } from "react";
import type {
  RecurrenceFrequency,
  RecurringRule,
  RoutineTemplateKind,
} from "@/lib/daily-planner/types";
import { dayKey } from "@/lib/daily-planner/date";

const FREQ: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_GRID = (() => {
  const rows: number[][] = [];
  for (let r = 0; r < 4; r++) {
    rows.push(
      Array.from({ length: 7 }, (_, c) => r * 7 + c + 1).filter((d) => d <= 31)
    );
  }
  return rows;
})();

type Props = {
  rules: RecurringRule[];
  newId: () => string;
  onAdd: (r: RecurringRule) => void;
  onReplace: (r: RecurringRule) => void;
  onRemove: (id: string) => void;
  onAppendToTemplate: (kind: RoutineTemplateKind, rule: RecurringRule) => void;
  onAppendToToday: (rule: RecurringRule) => void;
};

function emptyForm(): Omit<RecurringRule, "id" | "order"> {
  return {
    title: "",
    description: "",
    domainTags: [],
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5],
    monthDays: [1],
    biweeklyAnchor: dayKey(new Date()),
    defaultStartMinutes: null,
    defaultDurationMinutes: null,
  };
}

/** "09:00" <-> 540. Returns "" for null to clear inputs. */
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

function freqLabel(r: RecurringRule) {
  switch (r.frequency) {
    case "daily":
      return "Every day";
    case "weekly":
      return r.weekdays.length
        ? `Weekly (${r.weekdays.map((i) => DOW[i]).join(", ")})`
        : "Weekly (pick days)";
    case "biweekly":
      return r.weekdays.length
        ? `Bi-weekly (${r.weekdays.map((i) => DOW[i]).join(", ")})`
        : "Bi-weekly (pick days)";
    case "monthly":
      return r.monthDays.length
        ? `Monthly (days: ${r.monthDays.sort((a, b) => a - b).join(", ")})`
        : "Monthly (pick dates)";
    default:
      return r.frequency;
  }
}

const TEMPLATE_OPTIONS: { kind: RoutineTemplateKind; label: string }[] = [
  { kind: "weekdays", label: "Weekdays template" },
  { kind: "saturday", label: "Saturday template" },
  { kind: "sunday", label: "Sunday template" },
  { kind: "fallback", label: "Fallback template" },
];

function AddToPlanMenu({
  rule,
  onClose,
  onAppendToToday,
  onAppendToTemplate,
}: {
  rule: RecurringRule;
  onClose: () => void;
  onAppendToToday: (r: RecurringRule) => void;
  onAppendToTemplate: (kind: RoutineTemplateKind, r: RecurringRule) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-20 mt-1 min-w-[208px] overflow-hidden rounded-lg border border-white/10 bg-[#16161f] py-1 shadow-xl"
      role="menu"
    >
      <button
        type="button"
        onClick={() => {
          onAppendToToday(rule);
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
      >
        Today&apos;s plan
      </button>
      <div className="my-1 border-t border-white/[0.06]" />
      {TEMPLATE_OPTIONS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          onClick={() => {
            onAppendToTemplate(kind, rule);
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function RecurringRoutinesPanel({
  rules,
  newId,
  onAdd,
  onReplace,
  onRemove,
  onAppendToTemplate,
  onAppendToToday,
}: Props) {
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);
  const [addMenuRuleId, setAddMenuRuleId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-white/50 text-sm max-w-2xl">
        Build a library of routines (schedule + domain tags for tab time). They stay here
        until you use Add to copy one into a template or onto today&apos;s plan — then it
        appears in your blocks (for example Daily Routine) and tracks time like any other task.
      </p>

      <div className="space-y-2">
        {rules
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((r) => (
            <div
              key={r.id}
              className="relative flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-white/90 font-medium truncate">{r.title || "(no title)"}</p>
                <p className="text-white/40 text-xs mt-0.5">{freqLabel(r)}</p>
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAddMenuRuleId((id) => (id === r.id ? null : r.id))}
                    className="text-sm text-emerald-400/90 hover:text-emerald-300"
                  >
                    Add
                  </button>
                  {addMenuRuleId === r.id && (
                    <AddToPlanMenu
                      rule={r}
                      onClose={() => setAddMenuRuleId(null)}
                      onAppendToToday={onAppendToToday}
                      onAppendToTemplate={onAppendToTemplate}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="text-sm text-violet-400/90 hover:text-violet-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(r.id)}
                  className="text-sm text-red-400/80 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        {rules.length === 0 && (
          <p className="text-white/35 text-sm py-2">No recurring tasks yet.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="px-4 py-2.5 rounded-xl bg-violet-600/80 text-white text-sm font-medium hover:bg-violet-500"
      >
        + Add recurring task
      </button>

      {editing != null && (
        <RecurringRuleModal
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          newId={newId}
          maxOrder={rules.reduce((m, r) => Math.max(m, r.order), -1)}
          onSave={(r) => {
            if (editing === "new") onAdd(r);
            else onReplace(r);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RecurringRuleModal({
  initial,
  newId,
  maxOrder,
  onSave,
  onClose,
}: {
  initial: RecurringRule | null;
  newId: () => string;
  maxOrder: number;
  onSave: (r: RecurringRule) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RecurringRule>(() => {
    if (initial)
      return {
        ...initial,
        description: initial.description ?? "",
        defaultStartMinutes: initial.defaultStartMinutes ?? null,
        defaultDurationMinutes: initial.defaultDurationMinutes ?? null,
      };
    return {
      ...emptyForm(),
      id: newId(),
      order: maxOrder + 1,
      biweeklyAnchor: dayKey(new Date()),
    } as RecurringRule;
  });

  const set = (patch: Partial<RecurringRule>) =>
    setForm((f) => ({ ...f, ...patch }));

  const toggleDow = (d: number) => {
    const w = form.weekdays.includes(d)
      ? form.weekdays.filter((x) => x !== d)
      : [...form.weekdays, d].sort();
    set({ weekdays: w });
  };

  const toggleMonth = (d: number) => {
    const m = form.monthDays.includes(d)
      ? form.monthDays.filter((x) => x !== d)
      : [...form.monthDays, d].sort((a, b) => a - b);
    set({ monthDays: m });
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (form.frequency === "weekly" || form.frequency === "biweekly") {
      if (form.weekdays.length === 0) return;
    }
    if (form.frequency === "monthly" && form.monthDays.length === 0) return;
    const domains = form.domainTags
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => d.toLowerCase().replace(/^www\./, ""));
    onSave({
      ...form,
      title: form.title.trim(),
      domainTags: domains,
      biweeklyAnchor:
        !initial && form.frequency === "biweekly"
          ? dayKey(new Date())
          : form.biweeklyAnchor,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" role="dialog">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-6 space-y-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white">
          {initial ? "Update routine" : "New routine"}
        </h3>

        <label className="block text-sm text-white/50">Title</label>
        <input
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white"
          placeholder="e.g. Job application"
          autoFocus
        />

        <label className="block text-sm text-white/50">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/30 resize-none focus:outline-none focus:border-violet-500/40"
          placeholder="Notes about this routine"
        />

        <p className="text-sm text-white/50">Select the routine frequency</p>
        <div className="flex flex-wrap gap-2">
          {FREQ.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => set({ frequency: value })}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                form.frequency === value
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(form.frequency === "weekly" || form.frequency === "biweekly") && (
          <>
            <p className="text-sm text-white/50">Select the week days</p>
            <div className="flex flex-wrap gap-2">
              {DOW.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDow(i)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs ${
                    form.weekdays.includes(i)
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {form.frequency === "monthly" && (
          <>
            <p className="text-sm text-white/50">Select the dates (day of month)</p>
            <div className="space-y-1">
              {MONTH_GRID.map((row, ri) => (
                <div key={ri} className="flex flex-wrap gap-1.5">
                  {row.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleMonth(d)}
                      className={`w-9 h-9 rounded-lg text-sm ${
                        form.monthDays.includes(d)
                          ? "bg-white/20 text-white"
                          : "bg-white/5 text-white/45"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        <div>
          <span className="text-xs text-white/45">Domains (tab time)</span>
          <input
            value={form.domainTags.join(", ")}
            onChange={(e) => {
              const parts = e.target.value
                .split(/[,;]+/)
                .map((d) => d.trim())
                .filter(Boolean);
              set({ domainTags: parts });
            }}
            className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white/90"
            placeholder="github.com, notion.so"
          />
        </div>

        {form.frequency === "biweekly" && (
          <p className="text-xs text-white/35">
            Bi-weekly count starts from anchor date{" "}
            <strong className="text-white/50">{form.biweeklyAnchor}</strong> (set when
            this rule was created). Stills matching selected weekdays every other
            week.
          </p>
        )}

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Default time (optional)</span>
            {(form.defaultStartMinutes != null || form.defaultDurationMinutes != null) && (
              <button
                type="button"
                onClick={() =>
                  set({ defaultStartMinutes: null, defaultDurationMinutes: null })
                }
                className="text-xs text-white/40 hover:text-white/70"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-white/35">
            When set, this routine drops onto your timeline at this time. Leave
            empty to keep it unscheduled.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-white/45">Start</span>
              <input
                type="time"
                step={900}
                value={minutesToTimeString(form.defaultStartMinutes)}
                onChange={(e) => {
                  const m = timeStringToMinutes(e.target.value);
                  set({
                    defaultStartMinutes: m,
                    defaultDurationMinutes:
                      m != null && form.defaultDurationMinutes == null
                        ? 60
                        : form.defaultDurationMinutes,
                  });
                }}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white/90"
              />
            </div>
            <div>
              <span className="text-xs text-white/45">Duration (min)</span>
              <input
                type="number"
                min={15}
                step={15}
                value={form.defaultDurationMinutes ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  set({
                    defaultDurationMinutes:
                      v === "" ? null : Math.max(15, Number(v) || 15),
                  });
                }}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white/90"
                placeholder="60"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-white/15 text-white font-medium hover:bg-white/20"
          >
            {initial ? "Update routine" : "Save routine"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/15 text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
