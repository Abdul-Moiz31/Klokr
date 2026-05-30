"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type PlanTier = "free" | "standard" | "pro";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  provider: string;
  created_at: string;
  sessions30d: number;
  lastActive: string | null;
  banned: boolean;
  isAdmin: boolean;
  /** Effective plan after resolving manual grant + Stripe. */
  plan: PlanTier;
  /** Whether the current plan is a manual admin grant (vs Stripe / free). */
  manualPlan: PlanTier | null;
}

const PLAN_BADGE: Record<PlanTier, string> = {
  free: "bg-white/5 text-white/40 border-white/10",
  standard: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  pro: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Modal backdrop ──────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      setError("");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json() as { error: string };
        setError(msg);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 text-base font-semibold text-white">Edit user</h2>
      <p className="mb-5 text-xs text-white/35 font-mono">{user.id}</p>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

// ── Delete Modal ────────────────────────────────────────────────────────────
function DeleteModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      setError("");
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error: msg } = await res.json() as { error: string };
        setError(msg);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
      </div>
      <h2 className="mb-1 text-base font-semibold text-white">Delete user?</h2>
      <p className="mb-1 text-sm text-white/50">
        This will permanently delete <span className="font-medium text-white/80">{user.email}</span> and all their data.
      </p>
      <p className="mb-5 text-xs text-red-400/70">This action cannot be undone.</p>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={pending}
          className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </Modal>
  );
}

// ── Plan Modal ──────────────────────────────────────────────────────────────
function PlanModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanTier>(user.manualPlan ?? user.plan);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // "Clear grant" → send null so the user falls back to their Stripe plan/free.
  const save = (value: PlanTier | null) => {
    startTransition(async () => {
      setError("");
      const res = await fetch(`/api/admin/users/${user.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: value, note }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json() as { error: string };
        setError(msg);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 text-base font-semibold text-white">Set plan</h2>
      <p className="mb-1 text-sm text-white/50">{user.email}</p>
      <p className="mb-5 text-xs text-white/35">
        A manual grant gives access with no charge and overrides Stripe. Use for comps, team members, or support.
      </p>

      <div className="mb-4 flex gap-2">
        {(["free", "standard", "pro"] as PlanTier[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlan(p)}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-all ${
              plan === p ? PLAN_BADGE[p] : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <label className="mb-1.5 block text-xs font-medium text-white/50">Note <span className="text-white/25">(optional)</span></label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Beta tester comp"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
      />

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex gap-3">
        {user.manualPlan && (
          <button
            onClick={() => save(null)}
            disabled={pending}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors disabled:opacity-50"
          >
            Clear grant
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => save(plan)}
          disabled={pending}
          className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : plan === "free" ? "Set to Free" : `Grant ${plan}`}
        </button>
      </div>
    </Modal>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function UserManagement({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [editingPlan, setEditingPlan] = useState<AdminUser | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Optimistic ban state: tracks overrides before server refresh lands
  const [bannedOverrides, setBannedOverrides] = useState<Record<string, boolean>>({});

  const getBanned = (u: AdminUser) =>
    bannedOverrides[u.id] !== undefined ? bannedOverrides[u.id] : u.banned;

  const toggleBan = async (user: AdminUser) => {
    const next = !getBanned(user);
    setTogglingId(user.id);
    // Optimistic update — button flips immediately
    setBannedOverrides((prev) => ({ ...prev, [user.id]: next }));
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: next }),
    });
    setTogglingId(null);
    if (!res.ok) {
      // Revert optimistic update on failure
      setBannedOverrides((prev) => ({ ...prev, [user.id]: !next }));
    } else {
      router.refresh();
    }
  };

  const active = users.filter((u) => u.sessions30d > 0).length;

  return (
    <>
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/30">Admin · Users</p>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-white/35">{users.length} total · {active} active last 30 days</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">User</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Provider</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Plan</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Joined</th>
              <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-white/25">Sessions (30d)</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Last active</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/25">Status</th>
              <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-white/25">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr
                key={u.id}
                className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${i === users.length - 1 ? "border-b-0" : ""} ${getBanned(u) ? "opacity-50" : ""}`}
              >
                <td className="px-6 py-3.5">
                  <p className="text-white/80">{u.name || u.email.split("@")[0]}</p>
                  <p className="text-xs text-white/35">{u.email}</p>
                  {u.isAdmin && (
                    <span className="mt-0.5 inline-block rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400">admin</span>
                  )}
                </td>
                <td className="px-6 py-3.5">
                  <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[11px] text-white/40 capitalize">{u.provider}</span>
                </td>
                <td className="px-6 py-3.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${PLAN_BADGE[u.plan]}`}>
                    {u.plan}
                  </span>
                  {u.manualPlan && (
                    <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">manual</span>
                  )}
                </td>
                <td className="px-6 py-3.5 text-white/40">{u.created_at ? fmtDate(u.created_at) : "—"}</td>
                <td className="px-6 py-3.5 text-right tabular-nums">
                  {u.sessions30d > 0 ? <span className="text-white/65">{u.sessions30d.toLocaleString()}</span> : <span className="text-white/20">0</span>}
                </td>
                <td className="px-6 py-3.5 text-white/40">
                  {u.lastActive ? fmtDate(u.lastActive) : <span className="text-white/20">never</span>}
                </td>
                <td className="px-6 py-3.5">
                  {getBanned(u) ? (
                    <span className="flex items-center gap-1.5 text-xs text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />Restricted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    {/* Edit */}
                    <button
                      onClick={() => setEditing(u)}
                      className="rounded-lg border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 transition-all"
                    >
                      Edit
                    </button>
                    {/* Plan */}
                    <button
                      onClick={() => setEditingPlan(u)}
                      className="rounded-lg border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all"
                    >
                      Plan
                    </button>
                    {/* Restrict / Unrestrict */}
                    {!u.isAdmin && (
                      <button
                        onClick={() => toggleBan(u)}
                        disabled={togglingId === u.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs transition-all disabled:opacity-50 ${
                          getBanned(u)
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        }`}
                      >
                        {togglingId === u.id ? "…" : getBanned(u) ? "Unrestrict" : "Restrict"}
                      </button>
                    )}
                    {/* Delete */}
                    {!u.isAdmin && (
                      <button
                        onClick={() => setDeleting(u)}
                        className="rounded-lg border border-red-500/15 bg-red-500/8 px-3 py-1.5 text-xs text-red-400/70 hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-400 transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-white/25">No users yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <EditModal user={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteModal user={deleting} onClose={() => setDeleting(null)} />}
      {editingPlan && <PlanModal user={editingPlan} onClose={() => setEditingPlan(null)} />}
    </>
  );
}
