"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ParsedTask = {
  title: string;
  startMinutes: number;
  endMinutes: number;
};

/* ── Parsers ─────────────────────────────────────────────── */

function parseTimeStr(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  // HH:MM with optional am/pm
  let m = /^(\d{1,2}):(\d{2})(am|pm)?$/.exec(s);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    if (m[3] === "pm" && h !== 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    return h * 60 + min;
  }
  // Ham/pm  e.g. "9am", "10pm"
  m = /^(\d{1,2})(am|pm)$/.exec(s);
  if (m) {
    let h = Number(m[1]);
    if (m[2] === "pm" && h !== 12) h += 12;
    if (m[2] === "am" && h === 12) h = 0;
    return h * 60;
  }
  // bare hour 0–23 only
  if (/^\d{1,2}$/.test(s)) {
    const h = Number(s);
    if (h >= 0 && h <= 23) return h * 60;
  }
  return null;
}

function fixEnd(start: number, end: number): number {
  if (end < start) {
    // overnight: PM start, early-AM end (e.g. 11:00 PM - 3:00 AM) → cap at end of day
    if (start >= 720 && end < 360) return 1439;
    return end + 12 * 60;
  }
  if (end === start) return start + 60;
  return end;
}

// Strip leading punctuation/whitespace that shouldn't be part of a task name
function cleanTitle(raw: string): string {
  return raw.trim().replace(/^[\s,;:\-–—•*#|]+/, "").trim();
}

export function parseTextSchedule(text: string): ParsedTask[] {
  const results: ParsedTask[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const T   = "\\d{1,2}(?::\\d{2})?(?:\\s*[ap]m)?";
  const SEP = `\\s*[-–—]\\s*|\\s+to\\s+`;

  // Pattern 1 (preferred): "START - END  title" or "START - END,title"
  // List-number prefix requires an explicit . or ) separator (not just a digit) so
  // "10:00 PM" is never mistaken for list item "1" + time "0:00 PM".
  const P1 = new RegExp(`^[\\s,;•*#|]*(?:\\d+[.)]\\s+)?(${T})\\s*(?:${SEP})(${T})\\s*[:|,]?\\s*(.+)$`, "i");
  // Pattern 3: "title (START - END)"
  const P3 = new RegExp(`^(.+?)\\s*\\((${T})\\s*(?:${SEP})(${T})\\)$`, "i");
  // Pattern 2: "title  START - END"  — title must not start with just punctuation
  const P2 = new RegExp(`^([A-Za-z].+?)\\s+(${T})\\s*(?:${SEP})(${T})$`, "i");

  // Pattern 4: "START  title – 2h"
  const P4 = new RegExp(`^(${T})\\s+(.+?)\\s*[-–]\\s*(\\d+(?:\\.\\d+)?)\\s*h$`, "i");

  for (const line of lines) {
    // Skip lines that look like CSV headers
    if (/^(title|task|name|event|start|end|time|duration)/i.test(line.trim())) continue;

    let pushed = false;
    for (const [re, si, ei, ti] of [
      [P1, 1, 2, 3],
      [P3, 2, 3, 1],
      [P2, 2, 3, 1],
    ] as [RegExp, number, number, number][]) {
      const m = re.exec(line);
      if (m) {
        const start = parseTimeStr(m[si]);
        const end   = parseTimeStr(m[ei]);
        const title = cleanTitle(m[ti]);
        if (start !== null && end !== null && title) {
          results.push({ title, startMinutes: start, endMinutes: fixEnd(start, end) });
          pushed = true;
          break;
        }
      }
    }
    if (!pushed) {
      const m4 = P4.exec(line);
      if (m4) {
        const start = parseTimeStr(m4[1]);
        const title = cleanTitle(m4[2]);
        const dur   = Math.round(parseFloat(m4[3]) * 60);
        if (start !== null && title) {
          results.push({ title, startMinutes: start, endMinutes: start + dur });
        }
      }
    }
  }

  return results;
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

export function parseCSVSchedule(text: string): ParsedTask[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map((h) => h.toLowerCase().trim());
  const col = (names: string[]) =>
    names.reduce<number>((found, n) => (found !== -1 ? found : headers.findIndex((h) => h.includes(n))), -1);

  const titleIdx = col(["title", "name", "task", "event", "activity", "subject", "description"]);
  const startIdx = col(["start", "from", "begin", "time"]);
  const endIdx   = col(["end", "to", "finish", "until", "stop"]);
  const durIdx   = col(["duration", "dur", "minute", "length", "mins", "hours"]);

  if (titleIdx === -1 || startIdx === -1) return [];

  return lines.slice(1).flatMap<ParsedTask>((line) => {
    const cols = parseCSVRow(line);
    const title = cleanTitle(cols[titleIdx] ?? "");
    const startStr = cols[startIdx]?.trim();
    if (!title || !startStr) return [];

    const start = parseTimeStr(startStr);
    if (start === null) return [];

    let end: number | null = null;
    if (endIdx !== -1 && cols[endIdx]) {
      const endStr = cols[endIdx]!.trim();
      const parsed = parseTimeStr(endStr);
      // Only use as end-time if it parses as a valid time (not a raw minute count)
      if (parsed !== null) end = parsed;
    }
    // Duration column — treat as minutes
    if (end === null && durIdx !== -1 && cols[durIdx]) {
      const durRaw = cols[durIdx]!.trim();
      // Could be "30 min", "1h", "1:30", or plain "30"
      const hrMatch = /^(\d+(?:\.\d+)?)\s*h/i.exec(durRaw);
      if (hrMatch) {
        end = start + Math.round(parseFloat(hrMatch[1]) * 60);
      } else {
        const durMin = parseInt(durRaw, 10);
        if (!isNaN(durMin) && durMin > 0 && durMin <= 480) end = start + durMin;
      }
    }
    // Default: 1h block
    if (end === null) end = start + 60;

    return [{ title, startMinutes: start, endMinutes: fixEnd(start, end) }];
  });
}

/* ── Formatting helpers ──────────────────────────────────── */

function fmtMin(m: number): string {
  const total = m % (24 * 60);
  const h   = Math.floor(total / 60);
  const min = total % 60;
  const period = h >= 12 ? "PM" : "AM";
  const dh   = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${String(min).padStart(2, "0")} ${period}`;
}

function looksLikeBinary(text: string): boolean {
  // XLSX / binary files contain NUL bytes or many non-printable chars
  let nonPrintable = 0;
  const sample = text.slice(0, 500);
  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) nonPrintable++;
  }
  return nonPrintable > 5;
}

/* ── Modal component ─────────────────────────────────────── */

type Props = {
  onImport: (tasks: ParsedTask[]) => void;
  onClose: () => void;
};

const TEXT_EXAMPLE = `9:00 - 10:00 Morning standup
10:00 - 12:00 Deep work
12:00 - 13:00 Lunch break
13:00 - 15:30 Project review
15:30 - 16:00 Email & messages
16:00 - 17:00 Wrap up`;

const CSV_EXAMPLE = `title,start,end
Morning standup,9:00,10:00
Deep work,10:00,12:00
Lunch break,12:00,13:00
Project review,13:00,15:30
Email & messages,15:30,16:00`;

export function TemplateImportModal({ onImport, onClose }: Props) {
  const [mode, setMode] = useState<"text" | "csv">("text");
  const [textValue, setTextValue] = useState("");
  const [csvValue, setCsvValue] = useState("");
  const [parsed, setParsed] = useState<ParsedTask[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [binaryWarning, setBinaryWarning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = () => {
    setParseError(null);
    const input = mode === "text" ? textValue : csvValue;
    if (!input.trim()) { setParseError("Paste some content first."); return; }
    const result = mode === "text" ? parseTextSchedule(input) : parseCSVSchedule(input);
    if (result.length === 0) {
      setParseError(
        mode === "text"
          ? "Couldn't find any time ranges. Each line needs a start–end time, e.g. \"9:00 - 10:00 Task name\"."
          : "Couldn't read the CSV. Check that it has title, start, and end (or duration) columns."
      );
      return;
    }
    setParsed(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBinaryWarning(false);

    // .xlsx/.xls are binary — can't use readAsText
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      setBinaryWarning(true);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (looksLikeBinary(content)) {
        setBinaryWarning(true);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setCsvValue(content ?? "");
      setParsed(null);
      setParseError(null);
    };
    reader.readAsText(file);
  };

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-violet-500/40 focus:outline-none resize-none font-mono";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-white/10 bg-[#12121a] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">Import schedule</h3>
            <p className="mt-0.5 text-xs text-white/35">Paste a schedule or upload a CSV — replaces all existing tasks in the template</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Mode toggle */}
          <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 gap-1">
            {([["text", "Paste schedule"], ["csv", "Upload CSV"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setParsed(null); setParseError(null); setBinaryWarning(false); }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  mode === m ? "bg-violet-600/25 text-violet-200" : "text-white/40 hover:text-white/65"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Text paste mode */}
          {mode === "text" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white/45">Your schedule</label>
                <button
                  type="button"
                  onClick={() => setShowExample((s) => !s)}
                  className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors"
                >
                  {showExample ? "Hide example" : "Show example"}
                </button>
              </div>

              <AnimatePresence>
                {showExample && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-2 rounded-xl border border-violet-500/15 bg-violet-500/[0.06] p-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-violet-300/50">Example format</p>
                      <pre className="text-[11px] leading-5 text-white/40 font-mono whitespace-pre-wrap">{TEXT_EXAMPLE}</pre>
                      <button
                        type="button"
                        onClick={() => { setTextValue(TEXT_EXAMPLE); setShowExample(false); }}
                        className="mt-2 text-[11px] text-violet-300/60 hover:text-violet-300 transition-colors"
                      >
                        Use this example →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea
                rows={10}
                value={textValue}
                onChange={(e) => { setTextValue(e.target.value); setParsed(null); setParseError(null); }}
                className={inputCls}
                placeholder={`9:00 - 10:00 Morning standup\n10:00 - 12:00 Deep work\n12:00 - 13:00 Lunch\n...`}
              />
              <p className="text-[11px] text-white/25">
                One task per line. Format: <span className="font-mono text-white/35">start – end  Task name</span><br />
                Supports: 9am–10am · 9:00–10:00 · 09:00 to 10:00 · 24-hour format
              </p>
            </div>
          )}

          {/* CSV mode */}
          {mode === "csv" && (
            <div className="space-y-3">
              {/* Binary warning */}
              {binaryWarning && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
                  <p className="text-xs font-semibold text-amber-300">Excel files (.xlsx) can&apos;t be read directly</p>
                  <p className="mt-0.5 text-[11px] text-amber-300/60">
                    Open your Excel file → File → Save As → CSV (.csv) — then upload the .csv file, or paste the data below.
                  </p>
                </div>
              )}

              {/* File upload */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center transition hover:border-violet-500/20 hover:bg-violet-500/[0.04]"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/25">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm font-medium text-white/50">Upload .csv or .tsv</p>
                <p className="text-[11px] text-white/25">Excel files: save as CSV first</p>
              </button>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/45">Or paste CSV here</label>
                  <button
                    type="button"
                    onClick={() => { setCsvValue(CSV_EXAMPLE); setParsed(null); }}
                    className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors"
                  >
                    Load example
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={csvValue}
                  onChange={(e) => { setCsvValue(e.target.value); setParsed(null); setParseError(null); }}
                  className={inputCls}
                  placeholder={`title,start,end\nMorning standup,9:00,10:00\nDeep work,10:00,12:00`}
                />
              </div>
              <p className="text-[11px] text-white/25">
                Required columns: <span className="text-white/40 font-mono">title</span>, <span className="text-white/40 font-mono">start</span>, and either <span className="text-white/40 font-mono">end</span> or <span className="text-white/40 font-mono">duration</span> (minutes).
              </p>
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3">
              <p className="text-xs text-red-400">{parseError}</p>
            </div>
          )}

          {/* Preview */}
          {parsed && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-white/50">{parsed.length} task{parsed.length !== 1 ? "s" : ""} found</p>
                <button type="button" onClick={() => setParsed(null)} className="text-[11px] text-white/30 hover:text-white/60">Edit</button>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/[0.07] max-h-64 overflow-y-auto">
                {parsed.map((t, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}>
                    <span className="shrink-0 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[11px] font-mono text-violet-300/80 tabular-nums whitespace-nowrap">
                      {fmtMin(t.startMinutes)}–{fmtMin(t.endMinutes)}
                    </span>
                    <span className="truncate text-sm text-white/75">{t.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-white/25">{t.endMinutes - t.startMinutes}m</span>
                  </div>
                ))}
              </div>
              {parsed.some(t => t.endMinutes - t.startMinutes > 240) && (
                <p className="mt-2 text-[11px] text-amber-300/70">
                  ⚠ Some tasks are over 4 hours — double-check the times look right before importing.
                </p>
              )}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5">
            {!parsed ? (
              <>
                <button type="button" onClick={handleParse} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500">
                  Parse schedule
                </button>
                <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/50 transition hover:text-white/80">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { onImport(parsed); onClose(); }}
                  className="flex-1 rounded-xl bg-emerald-600/80 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500/80"
                >
                  Add {parsed.length} task{parsed.length !== 1 ? "s" : ""} to template
                </button>
                <button type="button" onClick={() => setParsed(null)} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/50 transition hover:text-white/80">
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
