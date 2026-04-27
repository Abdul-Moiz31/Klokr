"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase";

type ChromeRuntime = {
  lastError?: { message: string };
  sendMessage: (
    extensionId: string,
    message: { type: string; token: string; userId: string },
    responseCallback?: () => void
  ) => void;
};

/**
 * Pushes the Supabase session to the Klokr extension so the popup can call /api.
 * Set NEXT_PUBLIC_Klokr_EXTENSION_ID in .env.local to your id from chrome://extensions.
 */
function sendSessionToExtension(accessToken: string, userId: string) {
  if (typeof window === "undefined") return;

  // Path 1: content script is injected on this page — postMessage is always available.
  window.postMessage({ type: "Klokr_AUTH", token: accessToken, userId }, window.location.origin);

  // Path 2: if the extension ID is configured, also send directly (faster, no round-trip).
  const extId = process.env.NEXT_PUBLIC_Klokr_EXTENSION_ID;
  if (!extId) return;
  const runtime = (window as unknown as { chrome?: { runtime?: ChromeRuntime } })
    .chrome?.runtime;
  if (!runtime?.sendMessage) return;
  runtime.sendMessage(
    extId,
    { type: "SET_AUTH", token: accessToken, userId },
    () => { void runtime.lastError; }
  );
}

export function ExtensionAuthSync() {
  useEffect(() => {
    const supabase = createClient();

    const pushFromSession = (
      session: { access_token: string; user: { id: string } } | null
    ) => {
      if (session?.access_token && session.user?.id) {
        sendSessionToExtension(session.access_token, session.user.id);
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }: { data: { session: { access_token: string; user: { id: string } } | null } }) => {
      pushFromSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { access_token: string; user: { id: string } } | null) => {
      pushFromSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
