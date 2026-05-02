"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AuthAmbientBackground } from "@/components/auth/AuthAmbientBackground";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.replace("/admin");
      } else {
        const { error: msg } = await res.json() as { error: string };
        setError(msg ?? "Invalid credentials.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0F] flex items-center justify-center p-6">
      <AuthAmbientBackground quotesAnchor="right" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-[2] w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="url(#adminGrad)" strokeWidth="2" />
            <circle cx="14" cy="14" r="3" fill="url(#adminGrad)" />
            <line x1="14" y1="14" x2="14" y2="6" stroke="url(#adminGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="14" x2="19" y2="17" stroke="url(#adminGrad)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="adminGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-xl font-bold text-white">Klokrs</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <div className="mb-7 text-center">
            <h1 className="mb-2 text-2xl font-bold text-white">Admin access</h1>
            <p className="text-sm text-white/50">Restricted to authorized personnel only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordInput
              label="Password"
              placeholder="Your admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/40">
          Not an admin?{" "}
          <a href="/" className="text-violet-400 transition-colors hover:text-violet-300">
            Go home
          </a>
        </p>
      </motion.div>
    </div>
  );
}
