"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

/**
 * Auth gate hook for protected pages.
 *
 * Why this exists: `supabase.auth.getSession()` briefly returns null while the
 * SDK is mid-refresh (token expiring + autoRefresh fetching the new one). The
 * old per-page guards called `getSession()` once and redirected to /login on
 * null — that produced silent logouts whenever the user happened to load a
 * page during a refresh window.
 *
 * This hook is patient:
 *   1. Try getSession() immediately.
 *   2. If null, subscribe to onAuthStateChange and wait up to `waitMs` for any
 *      auth event that yields a session (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED).
 *   3. Only redirect to /login if the wait expires with no session OR the user
 *      explicitly signed out (SIGNED_OUT event).
 *
 * After mount, listen for SIGNED_OUT. It fires on explicit signOut(),
 * restricted accounts, or refresh-token revocation — but the last case also
 * covers a recoverable race against the extension (see ExtensionAuthSync.tsx),
 * so SIGNED_OUT gets a short grace window to recover a session before
 * redirecting, instead of bouncing immediately.
 *
 * The session is kept fresh in state via onAuthStateChange, including
 * TOKEN_REFRESHED events.
 */
export function useAuthSession(options?: {
  waitMs?: number;
  redirectTo?: string;
}): { session: Session | null; status: "loading" | "authenticated" | "unauthenticated" } {
  const waitMs = options?.waitMs ?? 3000;
  const redirectTo = options?.redirectTo ?? "/login";

  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const redirectOnce = () => {
      if (redirectedRef.current || cancelled) return;
      redirectedRef.current = true;
      router.replace(redirectTo);
    };

    let signedOutTimer: ReturnType<typeof setTimeout> | undefined;

    // Subscribe FIRST so we don't miss an event that fires between getSession()
    // resolving and the listener attaching.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, s: Session | null) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setStatus("unauthenticated");
        // Don't bounce instantly. SIGNED_OUT also fires when the extension and
        // this tab raced on Supabase's single-use rotating refresh token (see
        // ExtensionAuthSync.tsx) — the extension recovers by handing this tab
        // its own last-known-good token, but that arrives via an async
        // chrome.runtime round-trip a few hundred ms later. Give it a grace
        // window before treating this as a real logout.
        if (signedOutTimer) clearTimeout(signedOutTimer);
        signedOutTimer = setTimeout(() => {
          if (cancelled) return;
          void supabase.auth.getSession().then(({ data: { session: recovered } }: { data: { session: Session | null } }) => {
            if (cancelled) return;
            if (recovered) {
              setSession(recovered);
              setStatus("authenticated");
            } else {
              redirectOnce();
            }
          });
        }, 1500);
        return;
      }
      if (s) {
        if (signedOutTimer) {
          clearTimeout(signedOutTimer);
          signedOutTimer = undefined;
        }
        setSession(s);
        setStatus("authenticated");
      }
      // For other events without a session (USER_DELETED, etc.), let the
      // patient-wait logic decide; don't redirect prematurely.
    });

    let waitTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const { data: { session: initial } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (initial) {
        setSession(initial);
        setStatus("authenticated");
        return;
      }

      // No session right now. Could be a real logout, or the SDK is mid-refresh.
      // Give it a window to recover via onAuthStateChange.
      waitTimer = setTimeout(() => {
        if (cancelled) return;
        // Re-check once more before giving up — handles the case where a session
        // arrived but our state hadn't flushed.
        void supabase.auth.getSession().then(({ data: { session: late } }: { data: { session: Session | null } }) => {
          if (cancelled) return;
          if (late) {
            setSession(late);
            setStatus("authenticated");
          } else {
            setStatus("unauthenticated");
            redirectOnce();
          }
        });
      }, waitMs);
    })();

    return () => {
      cancelled = true;
      if (waitTimer) clearTimeout(waitTimer);
      if (signedOutTimer) clearTimeout(signedOutTimer);
      subscription.unsubscribe();
    };
  }, [router, redirectTo, waitMs]);

  return { session, status };
}
