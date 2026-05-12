"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

/** Returns the right CTA href depending on auth state.
 *  Logged-in  → /dashboard
 *  Logged-out → /signup (optionally with ?email=)
 */
export function useAuthCta(email?: string): string {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e: string, session: Session | null) => {
      setLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loggedIn) return "/dashboard";
  return email ? `/signup?email=${encodeURIComponent(email)}` : "/signup";
}
