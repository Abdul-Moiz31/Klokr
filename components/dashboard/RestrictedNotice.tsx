"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SUPPORT_EMAIL , AdminEmail } from "@/lib/constants";

export function RestrictedNotice() {
  const router = useRouter();
  const [restricted, setRestricted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const check = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user?.app_metadata?.restricted === true) {
        setRestricted(true);
      }
    };

    void check();

    // Re-check whenever auth state changes (e.g. token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (!restricted) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0f0f16] p-8 shadow-2xl shadow-black/60 text-center">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f87171"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <h2 className="mb-2 text-lg font-bold text-white">Account Restricted</h2>
        <p className="mb-1 text-sm text-white/55 leading-relaxed">
          Your account has been restricted by an administrator.
        </p>
        <p className="mb-6 text-sm text-white/55 leading-relaxed">
          Please contact{" "}
          <a
            href={`mailto:${AdminEmail}?subject=Account%20Restriction%20Assistance&body=Hello%20Admin%2C%0A%0AI%20noticed%20that%20my%20account%20is%20restricted.%20Could%20you%20please%20provide%20more%20details%20on%20the%20reason%20for%20this%3F%0A%0AThank%20you.`}
            className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            {AdminEmail}
          </a>{" "}
          for assistance.
        </p>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded-xl bg-red-600/80 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
