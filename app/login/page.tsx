"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { AuthAmbientBackground } from "@/components/auth/AuthAmbientBackground";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const router = useRouter();

  const handleLogin = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("banned") || msg.includes("restricted")) {
        setRestricted(true);
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      if (data.session) {
        window.postMessage(
          {
            type: "Klokrs_AUTH",
            token: data.session.access_token,
            refreshToken: data.session.refresh_token,
            userId: data.session.user.id,
          },
          window.location.origin
        );
      }
      router.push("/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = resetEmail.trim();
    if (!addr) return;
    setResetLoading(true);
    setResetMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setResetMsg({ type: "err", text: error.message });
    } else {
      setResetMsg({ type: "ok", text: "Check your inbox — we sent a reset link." });
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Restricted account modal */}
      {restricted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0f0f16] p-8 text-center shadow-2xl shadow-black/60"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">Account Restricted</h2>
            <p className="mb-1 text-sm leading-relaxed text-white/55">
              Your account has been restricted by an administrator.
            </p>
            <p className="mb-6 text-sm leading-relaxed text-white/55">
              To restore access, please contact{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-violet-400 hover:text-violet-300 transition-colors">
                {SUPPORT_EMAIL}
              </a>
            </p>
            <button
              onClick={() => setRestricted(false)}
              className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:text-white/80"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
      <AuthAmbientBackground quotesAnchor="right" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-[2] w-full max-w-md"
      >
        <Link href="/" className="flex items-center gap-2 mb-8 justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="url(#g2)" strokeWidth="2" />
            <circle cx="14" cy="14" r="3" fill="url(#g2)" />
            <line x1="14" y1="14" x2="14" y2="6" stroke="url(#g2)" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="14" x2="19" y2="17" stroke="url(#g2)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="g2" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-bold text-xl">Klokrs</span>
        </Link>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-white/50 text-sm">Sign in to see your time data</p>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/90 text-sm font-medium transition-all duration-200 disabled:opacity-50 mb-5"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {!forgotMode ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="space-y-1">
                <PasswordInput
                  label="Password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setResetEmail(email); setResetMsg(null); }}
                    className="text-xs text-white/35 hover:text-violet-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-white/80">Reset your password</p>
                <p className="text-xs text-white/40">Enter your email and we&apos;ll send a reset link.</p>
              </div>
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
              {resetMsg && (
                <div className={`px-4 py-3 rounded-xl text-sm border ${
                  resetMsg.type === "ok"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}>
                  {resetMsg.text}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? "Sending…" : "Send reset link"}
              </Button>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setResetMsg(null); }}
                className="w-full text-center text-sm text-white/35 hover:text-white/60 transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          )}

          <p className="text-center text-white/40 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-violet-400 hover:text-violet-300 transition-colors">
              Sign Up Free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
