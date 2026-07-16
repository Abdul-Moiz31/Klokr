"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ExportRow {
  id: string;
  email: string;
  name: string;
  provider: string;
  created_at: string;
  banned: string;
}

interface Props {
  sessions90dCount: number;
  exportRows: ExportRow[];
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// Excel/Sheets treat a cell whose content starts with =, +, -, or @ as a
// formula to evaluate on open, not literal text. `name` (and in principle
// `email`) is attacker-controllable at signup — a full_name of
// `=HYPERLINK("http://evil.com","x")` would be exported verbatim, and an
// admin opening this export in a spreadsheet tool is exactly the expected
// workflow here. Prefixing a lone `'` forces those tools to render the
// value as plain text instead of evaluating it, without changing what a
// CSV-only consumer sees (the character has no meaning in CSV itself).
function sanitizeCsvCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function SettingsControls({ sessions90dCount, exportRows }: Props) {
  const router = useRouter();
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [purgePending, startPurge] = useTransition();

  const exportCSV = () => {
    const headers = ["id", "email", "name", "provider", "created_at", "banned"];
    const rows = exportRows.map((r) =>
      headers
        .map((h) => `"${sanitizeCsvCell(String(r[h as keyof ExportRow])).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klokrs-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const purgeSessions = (days: number) => {
    startPurge(async () => {
      setPurgeResult(null);
      const res = await fetch("/api/admin/purge-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: days }),
      });
      const data = await res.json() as { deleted?: number; error?: string };
      if (res.ok) {
        setPurgeResult(`Deleted ${data.deleted?.toLocaleString()} sessions.`);
        router.refresh();
      } else {
        setPurgeResult(`Error: ${data.error}`);
      }
    });
  };

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <div className="border-b border-white/[0.05] px-6 py-4">
          <h2 className="text-sm font-semibold text-white/70">Controls</h2>
          <p className="mt-0.5 text-xs text-white/35">Actions you can run from the dashboard</p>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {/* Export users */}
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-white/75">Export users as CSV</p>
              <p className="text-xs text-white/35">Download a CSV of all {exportRows.length} users with their metadata</p>
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/65 hover:border-white/20 hover:bg-white/8 hover:text-white transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Purge old sessions */}
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-white/75">Purge old session data</p>
              <p className="text-xs text-white/35">
                {sessions90dCount > 0
                  ? <>{sessions90dCount.toLocaleString()} sessions older than 90 days — <span className="text-amber-400/70">can be purged</span></>
                  : "No sessions older than 90 days"}
              </p>
            </div>
            <button
              onClick={() => setPurgeOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-2 text-xs font-medium text-red-400/70 hover:border-red-500/30 hover:bg-red-500/12 hover:text-red-400 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
              Purge data
            </button>
          </div>
        </div>
      </div>

      {/* Purge Modal */}
      {purgeOpen && (
        <Modal onClose={() => { setPurgeOpen(false); setPurgeResult(null); }}>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>
          <h2 className="mb-1 text-base font-semibold text-white">Purge session data</h2>
          <p className="mb-5 text-sm text-white/45">Delete sessions older than a cutoff. This frees up storage but removes historical data permanently.</p>

          {purgeResult ? (
            <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              purgeResult.startsWith("Error")
                ? "border-red-500/20 bg-red-500/10 text-red-400"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            }`}>
              {purgeResult}
            </div>
          ) : null}

          <div className="space-y-2">
            {[
              { label: "Older than 90 days", days: 90 },
              { label: "Older than 180 days", days: 180 },
              { label: "Older than 365 days", days: 365 },
            ].map(({ label, days }) => (
              <button
                key={days}
                onClick={() => purgeSessions(days)}
                disabled={purgePending}
                className="flex w-full items-center justify-between rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3 text-sm text-red-400/80 hover:border-red-500/25 hover:bg-red-500/10 transition-all disabled:opacity-50"
              >
                <span>{label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>

          <button
            onClick={() => { setPurgeOpen(false); setPurgeResult(null); }}
            className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Close
          </button>
        </Modal>
      )}
    </>
  );
}
