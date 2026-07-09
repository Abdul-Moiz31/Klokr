"use client";

import { useEffect, useRef, useState } from "react";
import type {
  RecurrenceFrequency,
  RecurringRule,
  RoutineTemplateKind,
} from "@/lib/daily-planner/types";
import { dayKey } from "@/lib/daily-planner/date";
import { normalizeDomainInput } from "@/lib/domain";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

const FREQ: { value: RecurrenceFrequency; label: string; hint: string }[] = [
  { value: "daily",     label: "Every day",  hint: "Runs daily" },
  { value: "weekly",    label: "Weekly",     hint: "Specific days each week" },
  { value: "biweekly",  label: "Bi-weekly",  hint: "Every other week" },
  { value: "monthly",   label: "Monthly",    hint: "Specific dates per month" },
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_GRID = (() => {
  const rows: number[][] = [];
  for (let r = 0; r < 4; r++) {
    rows.push(Array.from({ length: 7 }, (_, c) => r * 7 + c + 1).filter((d) => d <= 31));
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
    blockedDomainTags: [],
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5],
    monthDays: [1],
    biweeklyAnchor: dayKey(new Date()),
    defaultStartMinutes: null,
    defaultDurationMinutes: null,
  };
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

function freqBadge(r: RecurringRule): string {
  switch (r.frequency) {
    case "daily": return "Every day";
    case "weekly":
      return r.weekdays.length ? r.weekdays.map((i) => DOW[i]).join(" · ") : "Weekly";
    case "biweekly":
      return r.weekdays.length ? `Every 2 wks · ${r.weekdays.map((i) => DOW[i]).join(" · ")}` : "Bi-weekly";
    case "monthly":
      return r.monthDays.length ? `Monthly · ${r.monthDays.sort((a, b) => a - b).join(", ")}` : "Monthly";
    default: return r.frequency;
  }
}

const TEMPLATE_OPTIONS: { kind: RoutineTemplateKind; label: string }[] = [
  { kind: "weekdays", label: "Work day template" },
  { kind: "saturday", label: "Saturday template" },
  { kind: "sunday",   label: "Sunday template" },
  { kind: "fallback", label: "Any day template" },
];

function AddToPlanMenu({
  rule, onClose, onAppendToToday, onAppendToTemplate,
}: {
  rule: RecurringRule;
  onClose: () => void;
  onAppendToToday: (r: RecurringRule) => void;
  onAppendToTemplate: (kind: RoutineTemplateKind, r: RecurringRule) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full z-20 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#14141d] py-1.5 shadow-2xl" role="menu">
      <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Add to…</p>
      <button
        type="button"
        onClick={() => { onAppendToToday(rule); onClose(); }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/[0.06]"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        </span>
        Today&apos;s plan
      </button>
      <div className="my-1 border-t border-white/[0.05]" />
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/20">Save to template</p>
      {TEMPLATE_OPTIONS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          onClick={() => { onAppendToTemplate(kind, rule); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white/60 hover:bg-white/[0.06] hover:text-white/80"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function RecurringRoutinesPanel({ rules, newId, onAdd, onReplace, onRemove, onAppendToTemplate, onAppendToToday }: Props) {
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);
  const [addMenuRuleId, setAddMenuRuleId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {/* Rule list */}
      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white/50">No routines yet</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/30">
            Add tasks you do regularly — like morning review, deep work, or daily email.<br />
            Once added, drop them onto today or save them into a template.
          </p>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600/80 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Add your first routine
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {rules.slice().sort((a, b) => a.order - b.order).map((r) => (
              <div key={r.id} className="group relative flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 transition hover:border-white/10 hover:bg-white/[0.04]">
                {/* Recurrence icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/30">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white/85">{r.title || "(no title)"}</p>
                  <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-white/35">{freqBadge(r)}</span>
                    {r.defaultStartMinutes != null && (
                      <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/30">
                        {minutesToTimeString(r.defaultStartMinutes)}
                        {r.defaultDurationMinutes ? ` · ${r.defaultDurationMinutes}m` : ""}
                      </span>
                    )}
                    {r.domainTags.length > 0 && (
                      <span className="rounded-full border border-cyan-500/15 bg-cyan-500/8 px-2 py-0.5 text-[10px] text-cyan-300/60">
                        {r.domainTags.slice(0, 2).join(", ")}{r.domainTags.length > 2 ? ` +${r.domainTags.length - 2}` : ""}
                      </span>
                    )}
                    {(r.blockedDomainTags?.length ?? 0) > 0 && (
                      <span className="rounded-full border border-red-500/15 bg-red-500/8 px-2 py-0.5 text-[10px] text-red-300/60">
                        Blocks {r.blockedDomainTags!.slice(0, 2).join(", ")}{r.blockedDomainTags!.length > 2 ? ` +${r.blockedDomainTags!.length - 2}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {/* Add button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAddMenuRuleId((id) => (id === r.id ? null : r.id))}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
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
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/50 transition hover:border-white/15 hover:text-white/75"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(r.id)}
                    className="rounded-lg p-1.5 text-white/20 transition hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Remove"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3.5 text-sm text-white/40 transition hover:border-violet-500/20 hover:bg-violet-500/[0.04] hover:text-violet-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Add routine
          </button>
        </>
      )}

      {/* Edit / create modal */}
      {editing != null && (
        <RecurringRuleModal
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          newId={newId}
          maxOrder={rules.reduce((m, r) => Math.max(m, r.order), -1)}
          onSave={(r) => { if (editing === "new") onAdd(r); else onReplace(r); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Confirm remove */}
      {confirmRemoveId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f0f16] p-7 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-white">Remove routine?</h3>
            <p className="mb-6 text-sm text-white/50">
              This will also remove it from today&apos;s plan if it&apos;s there.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemoveId(null)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white/80">Cancel</button>
              <button
                onClick={() => { onRemove(confirmRemoveId); setConfirmRemoveId(null); }}
                className="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Recurring rule modal ─────────────────────────────────── */

function Field({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-white/45">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      {children}
    </div>
  );
}

function RecurringRuleModal({
  initial, newId, maxOrder, onSave, onClose,
}: {
  initial: RecurringRule | null;
  newId: () => string;
  maxOrder: number;
  onSave: (r: RecurringRule) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RecurringRule>(() => {
    if (initial) {
      return {
        ...initial,
        description: initial.description ?? "",
        blockedDomainTags: initial.blockedDomainTags ?? [],
        defaultStartMinutes: initial.defaultStartMinutes ?? null,
        defaultDurationMinutes: initial.defaultDurationMinutes ?? null,
      };
    }
    return { ...emptyForm(), id: newId(), order: maxOrder + 1, biweeklyAnchor: dayKey(new Date()) } as RecurringRule;
  });

  const set = (patch: Partial<RecurringRule>) => setForm((f) => ({ ...f, ...patch }));

  const toggleDow = (d: number) => {
    const w = form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort();
    set({ weekdays: w });
  };

  const toggleMonth = (d: number) => {
    const m = form.monthDays.includes(d) ? form.monthDays.filter((x) => x !== d) : [...form.monthDays, d].sort((a, b) => a - b);
    set({ monthDays: m });
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if ((form.frequency === "weekly" || form.frequency === "biweekly") && form.weekdays.length === 0) return;
    if (form.frequency === "monthly" && form.monthDays.length === 0) return;
    const normalize = (list: string[]) => list.map(normalizeDomainInput).filter(Boolean);
    const domains = normalize(form.domainTags);
    const blockedDomains = normalize(form.blockedDomainTags ?? []);
    onSave({
      ...form,
      title: form.title.trim(),
      domainTags: domains,
      blockedDomainTags: blockedDomains,
      biweeklyAnchor: !initial && form.frequency === "biweekly" ? dayKey(new Date()) : form.biweeklyAnchor,
    });
  };

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl border border-white/10 bg-[#12121a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-base font-semibold text-white">{initial ? "Edit routine" : "New routine"}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Title */}
          <Field label="Task name">
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              className={inputCls}
              placeholder="e.g. Morning review, Deep work block"
              autoFocus
            />
          </Field>

          {/* Description */}
          <Field label="Notes (optional)">
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Any details about this routine"
            />
          </Field>

          {/* Frequency */}
          <Field label="How often?">
            <div className="grid grid-cols-2 gap-2">
              {FREQ.map(({ value, label, hint }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set({ frequency: value })}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    form.frequency === value
                      ? "border-violet-500/30 bg-violet-600/20 text-violet-200"
                      : "border-white/[0.07] bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white/75"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-0.5 text-[10px] opacity-60">{hint}</div>
                </button>
              ))}
            </div>
          </Field>

          {/* Weekday picker */}
          {(form.frequency === "weekly" || form.frequency === "biweekly") && (
            <Field label="Which days?">
              <div className="flex gap-1.5 flex-wrap">
                {DOW.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDow(i)}
                    className={`h-9 w-10 rounded-lg text-xs font-medium transition-all ${
                      form.weekdays.includes(i)
                        ? "bg-violet-600/30 border border-violet-500/30 text-violet-200"
                        : "border border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/65 hover:bg-white/[0.07]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.frequency === "biweekly" && (
                <p className="mt-1.5 text-[10px] text-white/25">Alternates every other week, starting from today.</p>
              )}
            </Field>
          )}

          {/* Monthly picker */}
          {form.frequency === "monthly" && (
            <Field label="Which dates?">
              <div className="space-y-1">
                {MONTH_GRID.map((row, ri) => (
                  <div key={ri} className="flex gap-1">
                    {row.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleMonth(d)}
                        className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${
                          form.monthDays.includes(d)
                            ? "bg-violet-600/30 border border-violet-500/30 text-violet-200"
                            : "border border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/65"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </Field>
          )}

          {/* Default time */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-white/50">Default time <span className="font-normal text-white/25">(optional)</span></p>
              {(form.defaultStartMinutes != null || form.defaultDurationMinutes != null) && (
                <button type="button" onClick={() => set({ defaultStartMinutes: null, defaultDurationMinutes: null })} className="text-[11px] text-white/35 hover:text-white/60">
                  Clear
                </button>
              )}
            </div>
            <p className="mb-3 text-[11px] text-white/25">When set, this routine lands on the timeline at this time automatically.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time">
                <input
                  type="time"
                  step={900}
                  value={minutesToTimeString(form.defaultStartMinutes)}
                  onChange={(e) => {
                    const m = timeStringToMinutes(e.target.value);
                    set({ defaultStartMinutes: m, defaultDurationMinutes: m != null && form.defaultDurationMinutes == null ? 60 : form.defaultDurationMinutes });
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="Duration (min)">
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={form.defaultDurationMinutes ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    set({ defaultDurationMinutes: v === "" ? null : Math.max(15, Number(v) || 15) });
                  }}
                  className={inputCls}
                  placeholder="60"
                />
              </Field>
            </div>
          </div>

          {/* Domains */}
          <Field
            label="Tab domains to track (optional)"
            tooltip="Tracked for this routine's progress bar. Only time spent on these domains during its scheduled window counts toward completion — everything else you browse is still recorded elsewhere, just not credited to this task."
          >
            <input
              value={form.domainTags.join(", ")}
              onChange={(e) => {
                const parts = e.target.value.split(/[,;]+/).map((d) => d.trim()).filter(Boolean);
                set({ domainTags: parts });
              }}
              className={inputCls}
              placeholder="github.com, notion.so, figma.com"
            />
            <p className="mt-1 text-[11px] text-white/25">Time on these sites counts toward this task&apos;s progress bar.</p>
          </Field>

          {/* Blocked domains */}
          <Field
            label="Blocked domains (optional)"
            tooltip="Blocked for the duration of this routine's window, regardless of the extension's always-blocked list in Settings. e.g. block youtube.com during a Reading block even if it's not on your always-blocked list."
          >
            <input
              value={form.blockedDomainTags?.join(", ") ?? ""}
              onChange={(e) => {
                const parts = e.target.value.split(/[,;]+/).map((d) => d.trim()).filter(Boolean);
                set({ blockedDomainTags: parts });
              }}
              className={inputCls}
              placeholder="youtube.com, reddit.com"
            />
            <p className="mt-1 text-[11px] text-white/25">Blocked only while this routine's window is active, on every materialized instance.</p>
          </Field>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              {initial ? "Save changes" : "Add routine"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/50 transition hover:text-white/80"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
