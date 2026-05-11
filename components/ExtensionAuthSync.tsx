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

    // Push current session immediately on mount.
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

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
