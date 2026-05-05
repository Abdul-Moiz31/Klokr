"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { AuthAmbientBackground } from "@/components/auth/AuthAmbientBackground";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY on this page when the reset link is clicked.
    // We wait for it before showing the form so the session is established.
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Also handle already-active session (e.g. user revisits the page).
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) {
      setMsg({ type: "err", text: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setMsg({ type: "err", text: "Passwords do not match." });
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMsg({ type: "err", text: error.message });
    } else {
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6 relative overflow-hidden">
      <AuthAmbientBackground quotesAnchor="right" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-[2] w-full max-w-md"
      >
        <Link href="/" className="flex items-center gap-2 mb-8 justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="url(#rg)" strokeWidth="2" />
            <circle cx="14" cy="14" r="3" fill="url(#rg)" />
            <line x1="14" y1="14" x2="14" y2="6" stroke="url(#rg)" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="14" x2="19" y2="17" stroke="url(#rg)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-bold text-xl">Klokrs</span>
        </Link>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8">
          {done ? (
            <div className="text-center py-4 space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-white font-semibold">Password updated</p>
              <p className="text-sm text-white/45">Redirecting you to the dashboard…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
              <p className="text-sm text-white/45">Verifying your reset link…</p>
              <p className="text-xs text-white/25">
                Link expired?{" "}
                <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
                  Request a new one
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="mb-7 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
                <p className="text-white/50 text-sm">Choose a strong password for your account</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <PasswordInput
                  label="New password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <PasswordInput
                  label="Confirm new password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {msg && (
                  <div className={`px-4 py-3 rounded-xl text-sm border ${
                    msg.type === "ok"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}>
                    {msg.text}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
