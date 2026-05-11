"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { AuthAmbientBackground } from "@/components/auth/AuthAmbientBackground";

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

// Splits camelCase or title-cases spaced names.
// "abdulMoiz" → "Abdul Moiz"  |  "Abdul moiz" → "Abdul Moiz"
function formatDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Already has spaces — title case each word
  if (trimmed.includes(" ")) {
    return trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  // camelCase — split on uppercase boundaries
  if (/[A-Z]/.test(trimmed)) {
    return trimmed
      .replace(/([A-Z])/g, " $1")
      .trim()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  // All lowercase — just capitalize first letter
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";

  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
      // Suggest a name from the email prefix (strip numbers/symbols)
      const prefix = prefillEmail.split("@")[0]?.replace(/[^a-zA-Z]/g, "") ?? "";
      if (prefix) setName(formatDisplayName(prefix));
    }
  }, [prefillEmail]);

  const handleSignup = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: formatDisplayName(name) },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (data.session) {
        window.postMessage(
          { type: "Klokrs_AUTH", token: data.session.access_token, userId: data.session.user.id },
          window.location.origin
        );
      }
      router.push("/dashboard");
    }
  };

  const handleGoogleSignup = async () => {
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
    <>
      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogleSignup}
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

      <form onSubmit={handleSignup} className="space-y-5">
        <Input
          label="Full name"
          type="text"
          placeholder="Abdul Moiz"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordInput
          label="Password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={loading || googleLoading}>
          {loading ? "Creating account…" : "Create Account"}
        </Button>
      </form>
    </>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6 relative overflow-hidden">
      <AuthAmbientBackground />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-[2] w-full max-w-md"
      >
        <Link href="/" className="flex items-center gap-2 mb-8 justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="url(#g1)" strokeWidth="2" />
            <circle cx="14" cy="14" r="3" fill="url(#g1)" />
            <line x1="14" y1="14" x2="14" y2="6" stroke="url(#g1)" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="14" x2="19" y2="17" stroke="url(#g1)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-bold text-xl">Klokrs</span>
        </Link>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
            <p className="text-white/50 text-sm">Start tracking your time in 60 seconds</p>
          </div>

          <Suspense fallback={null}>
            <SignupForm />
          </Suspense>

          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
              Log In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
