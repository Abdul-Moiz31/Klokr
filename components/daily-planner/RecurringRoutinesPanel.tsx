"use client";

import { useState } from "react";
import type { RecurrenceFrequency, RecurringRule } from "@/lib/daily-planner/types";
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
};

function emptyForm(): Omit<RecurringRule, "id" | "order"> {
  return {
    title: "",
    urgent: false,
    estimateMinutes: null,
    domainTags: [],
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5],
    monthDays: [1],
    biweeklyAnchor: dayKey(new Date()),
  };
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

export function RecurringRoutinesPanel({
  rules,
  newId,
  onAdd,
  onReplace,
  onRemove,
}: Props) {
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-white/50 text-sm max-w-2xl">
        Create repeating tasks once. They appear on matching calendar days in
        &quot;Today&quot; and send tab time to the listed domains. One rule, many
        days — no copying across weekday / weekend templates.
      </p>

      <div className="space-y-2">
        {rules
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-white/90 font-medium truncate">{r.title || "(no title)"}</p>
                <p className="text-white/40 text-xs mt-0.5">{freqLabel(r)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
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
    if (initial) return { ...initial };
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

        <label className="block text-sm text-white/50">Enter the routine task</label>
        <input
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white"
          placeholder="e.g. Job application"
          autoFocus
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

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={form.urgent}
            onChange={(e) => set({ urgent: e.target.checked })}
            className="rounded border-white/30 accent-amber-500"
          />
          Urgent (priority for tab time)
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-white/45">Est. (min)</span>
            <input
              type="number"
              min={0}
              value={form.estimateMinutes ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                set({ estimateMinutes: v === "" ? null : Number(v) });
              }}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white"
            />
          </div>
          <div className="sm:col-span-2">
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
        </div>

        {form.frequency === "biweekly" && (
          <p className="text-xs text-white/35">
            Bi-weekly count starts from anchor date{" "}
            <strong className="text-white/50">{form.biweeklyAnchor}</strong> (set when
            this rule was created). Stills matching selected weekdays every other
            week.
          </p>
        )}

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
