"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type ExtMessage = { type: string; [key: string]: unknown };

type ChromeRuntime = {
  lastError?: { message: string };
  sendMessage: (extensionId: string, message: ExtMessage, responseCallback?: () => void) => void;
};

/**
 * Pushes the Supabase session to the Klokrs extension so the popup can call /api.
 * Set NEXT_PUBLIC_Klokrs_EXTENSION_ID in .env.local to your id from chrome://extensions.
 */
function sendToExtension(message: ExtMessage) {
  if (typeof window === "undefined") return;

  // Path 1: content script postMessage bridge (always available on klokrs.com).
  window.postMessage({ ...message, _klokrs: true }, window.location.origin);

  // Path 2: direct runtime message if extension ID is configured (faster).
  const extId = process.env.NEXT_PUBLIC_Klokrs_EXTENSION_ID;
  if (!extId) return;
  const runtime = (window as unknown as { chrome?: { runtime?: ChromeRuntime } })
    .chrome?.runtime;
  if (!runtime?.sendMessage) return;
  try {
    runtime.sendMessage(extId, message, () => { void runtime.lastError; });
  } catch {
    // Extension not installed or context invalidated — ignore.
  }
}

export function ExtensionAuthSync() {
  useEffect(() => {
    const supabase = createClient();
    let recovering = false;
    let extensionResponded = false;

    // getSession() self-refreshes if the locally stored session is already
    // past its expiry margin (it does this even with autoRefreshToken: false
    // — see GoTrueClient's __loadSession). If this tab was asleep long enough
    // for that to be true, refreshing here with our own (possibly
    // already-rotated-out) refresh token would race the extension's copy.
    // Give the extension's on-load broadcast (below) a brief head start to
    // land first — content.js sends it synchronously on script injection, so
    // in practice it beats this timer — before falling back to our own
    // stored session.
    const initTimer = setTimeout(() => {
      if (extensionResponded) return;
      void supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (session?.access_token && session.user?.id) {
          sendToExtension({
            type: "SET_AUTH",
            token: session.access_token,
            refreshToken: session.refresh_token ?? "",
            userId: session.user.id,
          });
        }
      });
    }, 300);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (session?.access_token && session.user?.id) {
        // Logged in or token refreshed — push new credentials.
        sendToExtension({
          type: "SET_AUTH",
          token: session.access_token,
          refreshToken: session.refresh_token ?? "",
          userId: session.user.id,
        });
      } else if (event === "SIGNED_OUT") {
        // User explicitly signed out — tell the extension to clear its session.
        sendToExtension({ type: "LOGOUT" });
      }
    });

    // This client runs with autoRefreshToken: false (see lib/supabase.ts) —
    // the extension is the sole owner of the rotating Supabase refresh token,
    // since it runs 24/7 and refreshes proactively before expiry. Every token
    // the extension holds (fresh or newly rotated) flows to us through this
    // message, so we always adopt it rather than only recovering a dead
    // session — otherwise our own copy would just quietly go stale.
    let lastAdoptedToken: string | null = null;
    const onExtAuthState = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type !== "Klokrs_EXT_AUTH_STATE") return;
      const { token, refreshToken } = event.data as { token?: string; refreshToken?: string };
      if (!token || !refreshToken || recovering || token === lastAdoptedToken) return;

      extensionResponded = true;
      recovering = true;
      lastAdoptedToken = token;
      void supabase.auth
        .setSession({ access_token: token, refresh_token: refreshToken })
        .finally(() => { recovering = false; });
    };
    window.addEventListener("message", onExtAuthState);

    // Ask the extension for its current token whenever this tab regains
    // visibility — covers the case where a refresh broadcast was sent while
    // this tab was backgrounded/discarded and missed it.
    const requestAuthState = () => {
      window.postMessage({ type: "Klokrs_REQUEST_AUTH_STATE" }, window.location.origin);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestAuthState();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(initTimer);
      subscription.unsubscribe();
      window.removeEventListener("message", onExtAuthState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
